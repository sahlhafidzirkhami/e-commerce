import { randomBytes } from 'node:crypto';
import {
  CART_MAX_QUANTITY_PER_ITEM,
  ErrorCode,
  type CartItemIssue,
  type CartItemView,
  type CartView,
} from '@sportswear/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { HttpError } from '../../lib/http-error.js';
import { prisma } from '../../lib/prisma.js';

/** Siapa pemilik keranjang pada request ini. */
export interface CartOwner {
  userId?: string | undefined;
  /** Token keranjang tamu dari cookie. */
  token?: string | undefined;
}

export interface CartRef {
  id: string;
  token: string;
  userId: string | null;
}

export interface ResolvedCart {
  cart: CartRef | null;
  /** true bila cookie token tamu sudah tidak dipakai dan harus dihapus. */
  clearGuestToken: boolean;
}

const cartRefSelect = { id: true, token: true, userId: true } as const;

function newCartToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Menentukan keranjang untuk request ini.
 * Member yang login membawa cookie keranjang tamu: keranjang akun yang dipakai.
 * Bila keranjang akun kosong, keranjang tamu dipindahkan ke akun agar isinya tidak hilang;
 * bila tidak, keranjang tamu dihapus.
 */
export async function resolveCart(owner: CartOwner): Promise<ResolvedCart> {
  const guest = owner.token
    ? await prisma.cart.findFirst({
        where: { token: owner.token, userId: null },
        select: { ...cartRefSelect, _count: { select: { items: true } } },
      })
    : null;

  if (!owner.userId) {
    return {
      cart: guest ? { id: guest.id, token: guest.token, userId: null } : null,
      clearGuestToken: Boolean(owner.token) && !guest,
    };
  }

  const userCart = await prisma.cart.findUnique({
    where: { userId: owner.userId },
    select: { ...cartRefSelect, _count: { select: { items: true } } },
  });

  if (!guest) {
    return {
      cart: userCart ? { id: userCart.id, token: userCart.token, userId: userCart.userId } : null,
      clearGuestToken: Boolean(owner.token),
    };
  }

  const userId = owner.userId;
  const adoptGuest = guest._count.items > 0 && (!userCart || userCart._count.items === 0);

  const cart = await prisma.$transaction(async (tx) => {
    if (adoptGuest) {
      if (userCart) await tx.cart.delete({ where: { id: userCart.id } });
      return tx.cart.update({ where: { id: guest.id }, data: { userId }, select: cartRefSelect });
    }
    await tx.cart.delete({ where: { id: guest.id } });
    return userCart ? { id: userCart.id, token: userCart.token, userId: userCart.userId } : null;
  });

  return { cart, clearGuestToken: true };
}

/** Seperti resolveCart, tetapi membuat keranjang baru bila belum ada. */
export async function resolveOrCreateCart(
  owner: CartOwner,
): Promise<ResolvedCart & { cart: CartRef }> {
  const resolved = await resolveCart(owner);
  if (resolved.cart) return { ...resolved, cart: resolved.cart };

  const cart = await prisma.cart.create({
    data: { token: newCartToken(), userId: owner.userId ?? null },
    select: cartRefSelect,
  });
  return { ...resolved, cart };
}

const cartItemInclude = {
  variant: {
    select: {
      sku: true,
      size: true,
      price: true,
      stock: true,
      isActive: true,
      product: {
        select: {
          slug: true,
          name: true,
          isActive: true,
          category: { select: { isActive: true } },
          images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true, alt: true } },
        },
      },
    },
  },
} satisfies Prisma.CartItemInclude;

export type CartItemRecord = Prisma.CartItemGetPayload<{ include: typeof cartItemInclude }>;

function itemIssue(available: boolean, stock: number, quantity: number): CartItemIssue | null {
  if (!available) return 'UNAVAILABLE';
  if (stock === 0) return 'OUT_OF_STOCK';
  if (quantity > stock) return 'INSUFFICIENT_STOCK';
  return null;
}

/** Harga dan subtotal selalu dari data varian saat ini. Item bermasalah tidak masuk subtotal. */
export function buildCartView(items: readonly CartItemRecord[]): CartView {
  const views: CartItemView[] = items.map((item) => {
    const { variant } = item;
    const { product } = variant;
    const available = variant.isActive && product.isActive && (product.category?.isActive ?? true);
    const stock = available ? variant.stock : 0;
    const image = product.images[0];
    return {
      variantId: item.variantId,
      productSlug: product.slug,
      productName: product.name,
      size: variant.size,
      sku: variant.sku,
      image: image ? { url: image.url, alt: image.alt ?? product.name } : null,
      price: variant.price,
      quantity: item.quantity,
      stock,
      lineTotal: variant.price * item.quantity,
      issue: itemIssue(available, stock, item.quantity),
    };
  });

  return {
    items: views,
    itemCount: views.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: views.reduce((sum, item) => sum + (item.issue ? 0 : item.lineTotal), 0),
    hasIssues: views.some((item) => item.issue !== null),
  };
}

const EMPTY_CART: CartView = { items: [], itemCount: 0, subtotal: 0, hasIssues: false };

export async function getCartView(cartId: string | null): Promise<CartView> {
  if (!cartId) return EMPTY_CART;
  const items = await prisma.cartItem.findMany({
    where: { cartId },
    include: cartItemInclude,
    orderBy: { createdAt: 'asc' },
  });
  return buildCartView(items);
}

/** Tolak jumlah yang melebihi stok saat ini (F-05). */
export function assertQuantityAvailable(
  quantity: number,
  stock: number,
  size: string,
  alreadyInCart = 0,
): void {
  if (quantity > CART_MAX_QUANTITY_PER_ITEM) {
    throw HttpError.conflict(
      `Maksimal ${CART_MAX_QUANTITY_PER_ITEM} per ukuran dalam satu keranjang`,
      ErrorCode.INSUFFICIENT_STOCK,
    );
  }
  if (quantity <= stock) return;
  if (stock === 0) {
    throw HttpError.conflict(`Stok ukuran ${size} habis`, ErrorCode.INSUFFICIENT_STOCK);
  }
  const inCart = alreadyInCart > 0 ? `, ${alreadyInCart} sudah ada di keranjang` : '';
  throw HttpError.conflict(
    `Stok ukuran ${size} tersisa ${stock}${inCart}`,
    ErrorCode.INSUFFICIENT_STOCK,
  );
}

async function findPurchasableVariant(variantId: string) {
  const variant = await prisma.productVariant.findFirst({
    where: {
      id: variantId,
      isActive: true,
      product: {
        isActive: true,
        OR: [{ categoryId: null }, { category: { isActive: true } }],
      },
    },
    select: { id: true, size: true, stock: true },
  });
  if (!variant) {
    throw new HttpError(404, ErrorCode.PRODUCT_UNAVAILABLE, 'Produk ini tidak tersedia');
  }
  return variant;
}

export async function addItem(cartId: string, variantId: string, quantity: number): Promise<void> {
  const variant = await findPurchasableVariant(variantId);
  const existing = await prisma.cartItem.findUnique({
    where: { cartId_variantId: { cartId, variantId } },
    select: { quantity: true },
  });
  const inCart = existing?.quantity ?? 0;
  assertQuantityAvailable(inCart + quantity, variant.stock, variant.size, inCart);

  await prisma.cartItem.upsert({
    where: { cartId_variantId: { cartId, variantId } },
    create: { cartId, variantId, quantity },
    update: { quantity: inCart + quantity },
  });
}

export async function updateItem(
  cartId: string,
  variantId: string,
  quantity: number,
): Promise<void> {
  const existing = await prisma.cartItem.findUnique({
    where: { cartId_variantId: { cartId, variantId } },
    select: { id: true },
  });
  if (!existing) throw HttpError.notFound('Produk tidak ada di keranjang');

  const variant = await findPurchasableVariant(variantId);
  assertQuantityAvailable(quantity, variant.stock, variant.size);

  await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity } });
}

export async function removeItem(cartId: string, variantId: string): Promise<void> {
  await prisma.cartItem.deleteMany({ where: { cartId, variantId } });
}
