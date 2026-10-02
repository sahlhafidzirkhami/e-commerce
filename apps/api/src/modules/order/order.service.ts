import { timingSafeEqual } from 'node:crypto';
import {
  ErrorCode,
  ORDER_PAYMENT_TIMEOUT_HOURS,
  type CheckoutQuote,
  type CheckoutQuoteInput,
  type CreateOrderInput,
  type OrderView,
} from '@sportswear/shared';
import { Prisma } from '../../generated/prisma/client.js';
import { HttpError } from '../../lib/http-error.js';
import { prisma } from '../../lib/prisma.js';
import { resolveCart, type CartOwner } from '../cart/cart.service.js';
import { titleCase } from '../shipping/region.service.js';
import {
  quoteShipping as defaultQuoteShipping,
  type QuoteShipping,
  type ShippingQuote,
} from '../shipping/shipping.service.js';
import {
  calculateVoucherDiscount,
  claimVoucherQuota,
  findVoucherByCode,
  type VoucherRule,
} from '../voucher/voucher.service.js';
import { generateAccessToken, generateOrderNumber } from './order.number.js';
import { computeTotals, sumSubtotal, sumWeightGram, type PricedLine } from './order.totals.js';

export interface CheckoutContext {
  owner: CartOwner;
  now?: Date;
  quoteShipping?: QuoteShipping;
}

const PAYMENT_TIMEOUT_MS = ORDER_PAYMENT_TIMEOUT_HOURS * 60 * 60 * 1000;
const MAX_ORDER_NUMBER_ATTEMPTS = 3;

/** Isi keranjang terbaru dari database; harga, stok, dan berat dari varian saat ini. */
async function loadCartLines(db: Prisma.TransactionClient | typeof prisma, cartId: string) {
  const items = await db.cartItem.findMany({
    where: { cartId },
    orderBy: { createdAt: 'asc' },
    select: {
      variantId: true,
      quantity: true,
      variant: {
        select: {
          sku: true,
          size: true,
          price: true,
          stock: true,
          weightGram: true,
          isActive: true,
          product: {
            select: { name: true, isActive: true, category: { select: { isActive: true } } },
          },
        },
      },
    },
  });
  return items.map((item) => ({
    variantId: item.variantId,
    quantity: item.quantity,
    price: item.variant.price,
    weightGram: item.variant.weightGram,
    stock: item.variant.stock,
    sku: item.variant.sku,
    size: item.variant.size,
    productName: item.variant.product.name,
    available:
      item.variant.isActive &&
      item.variant.product.isActive &&
      (item.variant.product.category?.isActive ?? true),
  }));
}

type CartLine = Awaited<ReturnType<typeof loadCartLines>>[number];

function assertPurchasable(lines: readonly CartLine[]): void {
  if (lines.length === 0) {
    throw HttpError.badRequest('Keranjang masih kosong', ErrorCode.CART_EMPTY);
  }
  if (lines.some((line) => !line.available || line.quantity > line.stock)) {
    throw HttpError.conflict(
      'Ada barang di keranjang yang stoknya berubah. Periksa keranjang lalu coba lagi.',
      ErrorCode.CART_HAS_ISSUES,
    );
  }
}

async function requireCartId(owner: CartOwner): Promise<string> {
  const { cart } = await resolveCart(owner);
  if (!cart) throw HttpError.badRequest('Keranjang masih kosong', ErrorCode.CART_EMPTY);
  return cart.id;
}

async function quoteFor(
  lines: readonly PricedLine[],
  districtId: number,
  choice: { courier: string; service: string },
  quoteShipping: QuoteShipping,
): Promise<ShippingQuote> {
  return quoteShipping({
    destinationDistrictId: districtId,
    weightGram: sumWeightGram(lines),
    courier: choice.courier,
    service: choice.service,
  });
}

/** Total untuk ditampilkan di checkout. Tidak membuat order dan tidak memakai kuota voucher. */
export async function quoteCheckout(
  input: CheckoutQuoteInput,
  context: CheckoutContext,
): Promise<CheckoutQuote> {
  const now = context.now ?? new Date();
  const cartId = await requireCartId(context.owner);
  const lines = await loadCartLines(prisma, cartId);
  assertPurchasable(lines);

  const shipping = await quoteFor(
    lines,
    input.districtId,
    input.shipping,
    context.quoteShipping ?? defaultQuoteShipping,
  );
  const voucher = input.voucherCode ? await findVoucherByCode(input.voucherCode) : null;
  const discount = voucher ? calculateVoucherDiscount(voucher, sumSubtotal(lines), now) : 0;
  const totals = computeTotals(lines, shipping.cost, discount);

  return {
    ...totals,
    totalWeightGram: sumWeightGram(lines),
    voucher: voucher ? { code: voucher.code, discount: totals.discount } : null,
  };
}

export interface CreatedOrder {
  id: string;
  orderNumber: string;
  accessToken: string;
  total: number;
}

function isUniqueViolation(err: unknown, field: string): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002' &&
    JSON.stringify(err.meta ?? {}).includes(field)
  );
}

/**
 * Membuat order dari keranjang dalam satu transaksi: stok dikurangi dengan update
 * bersyarat, kuota voucher dipakai, item disalin sebagai snapshot, keranjang dikosongkan.
 */
export async function createOrder(
  input: CreateOrderInput,
  context: CheckoutContext,
): Promise<CreatedOrder> {
  const now = context.now ?? new Date();
  const cartId = await requireCartId(context.owner);

  const district = await prisma.district.findUnique({
    where: { id: input.address.districtId },
    select: { name: true, city: { select: { name: true, province: { select: { name: true } } } } },
  });
  if (!district) throw HttpError.badRequest('Kecamatan tujuan tidak ditemukan');

  // Ongkir dihitung di luar transaksi (panggilan jaringan), dari berat keranjang saat ini.
  const preview = await loadCartLines(prisma, cartId);
  assertPurchasable(preview);
  const quotedWeight = sumWeightGram(preview);
  const shipping = await quoteFor(
    preview,
    input.address.districtId,
    input.shipping,
    context.quoteShipping ?? defaultQuoteShipping,
  );
  const voucher: VoucherRule | null = input.voucherCode
    ? await findVoucherByCode(input.voucherCode)
    : null;

  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const lines = await loadCartLines(tx, cartId);
        assertPurchasable(lines);
        if (sumWeightGram(lines) !== quotedWeight) {
          throw HttpError.conflict(
            'Isi keranjang berubah saat checkout. Periksa lagi lalu coba lagi.',
            ErrorCode.CART_HAS_ISSUES,
          );
        }

        const discount = voucher ? calculateVoucherDiscount(voucher, sumSubtotal(lines), now) : 0;
        if (voucher) await claimVoucherQuota(tx, voucher.id, now);

        for (const line of lines) {
          const { count } = await tx.productVariant.updateMany({
            where: { id: line.variantId, isActive: true, stock: { gte: line.quantity } },
            data: { stock: { decrement: line.quantity } },
          });
          if (count !== 1) {
            throw HttpError.conflict(
              `Stok ${line.productName} ukuran ${line.size} baru saja habis. Periksa keranjang lalu coba lagi.`,
              ErrorCode.INSUFFICIENT_STOCK,
            );
          }
        }

        const totals = computeTotals(lines, shipping.cost, discount);
        const order = await tx.order.create({
          data: {
            orderNumber: generateOrderNumber(now),
            accessToken: generateAccessToken(),
            userId: context.owner.userId ?? null,
            status: 'pending',
            customerName: input.contact.name,
            customerEmail: input.contact.email,
            customerPhone: input.contact.phone,
            shippingRecipient: input.address.recipientName,
            shippingPhone: input.address.phone,
            shippingStreet: input.address.street,
            shippingDistrictId: input.address.districtId,
            // Nama dari RajaOngkir huruf kapital semua; simpan sama seperti yang dilihat pembeli.
            shippingDistrict: titleCase(district.name),
            shippingCity: titleCase(district.city.name),
            shippingProvince: titleCase(district.city.province.name),
            shippingPostalCode: input.address.postalCode,
            courier: shipping.courier,
            courierService: shipping.service,
            totalWeightGram: quotedWeight,
            subtotal: totals.subtotal,
            shippingCost: totals.shippingCost,
            discount: totals.discount,
            total: totals.total,
            voucherId: voucher?.id ?? null,
            voucherCode: voucher?.code ?? null,
            notes: input.notes || null,
            expiresAt: new Date(now.getTime() + PAYMENT_TIMEOUT_MS),
            createdAt: now,
            items: {
              create: lines.map((line) => ({
                variantId: line.variantId,
                productName: line.productName,
                variantLabel: `Ukuran ${line.size}`,
                sku: line.sku,
                price: line.price,
                quantity: line.quantity,
                subtotal: line.price * line.quantity,
              })),
            },
            statusHistory: {
              create: {
                fromStatus: null,
                toStatus: 'pending',
                note: 'Order dibuat',
                createdAt: now,
              },
            },
          },
          select: { id: true, orderNumber: true, accessToken: true, total: true },
        });

        await tx.cartItem.deleteMany({ where: { cartId } });
        return order;
      });
    } catch (err) {
      // Nomor order bentrok (sangat jarang): ulangi dengan nomor baru.
      if (attempt < MAX_ORDER_NUMBER_ATTEMPTS && isUniqueViolation(err, 'orderNumber')) continue;
      throw err;
    }
  }
}

function tokenMatches(expected: string, given: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface OrderViewer {
  userId?: string | undefined;
  token?: string | undefined;
}

/** Pemilik (member) atau pemegang token tautan (tamu). Selain itu dianggap tidak ada. */
export async function getOrderForViewer(
  orderNumber: string,
  viewer: OrderViewer,
): Promise<OrderView & { id: string }> {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: { orderBy: { id: 'asc' } } },
  });
  const allowed =
    order &&
    ((viewer.userId !== undefined && order.userId === viewer.userId) ||
      (viewer.token !== undefined && tokenMatches(order.accessToken, viewer.token)));
  if (!order || !allowed) throw HttpError.notFound('Pesanan tidak ditemukan');

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    shipping: {
      recipient: order.shippingRecipient,
      phone: order.shippingPhone,
      street: order.shippingStreet,
      district: order.shippingDistrict,
      city: order.shippingCity,
      province: order.shippingProvince,
      postalCode: order.shippingPostalCode,
      courier: order.courier,
      service: order.courierService,
      trackingNumber: order.trackingNumber,
    },
    items: order.items.map((item) => ({
      productName: item.productName,
      variantLabel: item.variantLabel,
      sku: item.sku,
      price: item.price,
      quantity: item.quantity,
      subtotal: item.subtotal,
    })),
    subtotal: order.subtotal,
    shippingCost: order.shippingCost,
    discount: order.discount,
    total: order.total,
    voucherCode: order.voucherCode,
    notes: order.notes,
    createdAt: order.createdAt.toISOString(),
    expiresAt: order.expiresAt.toISOString(),
    paidAt: order.paidAt?.toISOString() ?? null,
  };
}
