/**
 * Akun pembeli (F-08, F-18): buku alamat, riwayat pesanan, profil, hapus akun, dan
 * membuat akun dari pesanan tamu yang sudah dibayar.
 */
import {
  ADDRESS_BOOK_LIMIT,
  PAGINATION,
  type AccountAddress,
  type AccountOrderList,
  type AddressInput,
  type AuthUser,
  type OrderStatus,
  type ProfileInput,
} from '@sportswear/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { HttpError } from '../../lib/http-error.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { prisma } from '../../lib/prisma.js';
import { toAuthUser, type SessionUser } from '../auth/auth.service.js';
import { tokenMatches } from '../../lib/token-match.js';
import { titleCase } from '../shipping/region.service.js';

type Tx = Prisma.TransactionClient;

/** Pesanan yang masih berjalan: akun tidak boleh dihapus selama ada yang begini. */
const ACTIVE_STATUSES: OrderStatus[] = ['pending', 'paid', 'processing', 'shipped'];
/** Akun boleh dibuat dari pesanan yang sudah dibayar (F-08: "setelah bayar"). */
const PAID_STATUSES: OrderStatus[] = ['paid', 'processing', 'shipped', 'delivered', 'completed'];

// ─── Buku alamat ────────────────────────────────────────────────────────────

const addressInclude = {
  district: {
    select: {
      name: true,
      city: { select: { id: true, name: true, province: { select: { id: true, name: true } } } },
    },
  },
} as const;

type AddressRow = Prisma.AddressGetPayload<{ include: typeof addressInclude }>;

function toAccountAddress(a: AddressRow): AccountAddress {
  return {
    id: a.id,
    label: a.label,
    recipientName: a.recipientName,
    phone: a.phone,
    street: a.street,
    districtId: a.districtId,
    postalCode: a.postalCode,
    isDefault: a.isDefault,
    district: titleCase(a.district.name),
    city: titleCase(a.district.city.name),
    province: titleCase(a.district.city.province.name),
    cityId: a.district.city.id,
    provinceId: a.district.city.province.id,
  };
}

export async function listAddresses(userId: string): Promise<AccountAddress[]> {
  const rows = await prisma.address.findMany({
    where: { userId },
    // Alamat utama paling atas; dipakai otomatis di checkout.
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    include: addressInclude,
  });
  return rows.map(toAccountAddress);
}

async function assertDistrict(tx: Tx, districtId: number): Promise<void> {
  const found = await tx.district.findUnique({ where: { id: districtId }, select: { id: true } });
  if (!found) throw HttpError.badRequest('Kecamatan tidak ditemukan');
}

/**
 * Tambah alamat dalam transaksi yang mengunci baris user, agar dua permintaan bersamaan
 * tidak bisa melewati batas 5 alamat. Alamat pertama otomatis menjadi alamat utama.
 * `null` = buku alamat sudah penuh (hanya untuk pemanggil yang memilih mengabaikannya).
 */
export async function insertAddress(
  tx: Tx,
  userId: string,
  input: AddressInput,
): Promise<string | null> {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
  const count = await tx.address.count({ where: { userId } });
  if (count >= ADDRESS_BOOK_LIMIT) return null;
  await assertDistrict(tx, input.districtId);
  const created = await tx.address.create({
    data: { ...input, userId, isDefault: count === 0 },
    select: { id: true },
  });
  return created.id;
}

export async function createAddress(
  userId: string,
  input: AddressInput,
): Promise<AccountAddress[]> {
  const id = await prisma.$transaction((tx) => insertAddress(tx, userId, input));
  if (!id) {
    throw HttpError.conflict(
      `Buku alamat sudah penuh (maksimal ${ADDRESS_BOOK_LIMIT}). Hapus salah satu dulu.`,
      'ADDRESS_BOOK_FULL',
    );
  }
  return listAddresses(userId);
}

async function ownAddress(userId: string, id: string) {
  const address = await prisma.address.findFirst({ where: { id, userId } });
  if (!address) throw HttpError.notFound('Alamat tidak ditemukan');
  return address;
}

export async function updateAddress(
  userId: string,
  id: string,
  input: AddressInput,
): Promise<AccountAddress[]> {
  await ownAddress(userId, id);
  await assertDistrict(prisma, input.districtId);
  await prisma.address.update({ where: { id }, data: input });
  return listAddresses(userId);
}

export async function setDefaultAddress(userId: string, id: string): Promise<AccountAddress[]> {
  await ownAddress(userId, id);
  await prisma.$transaction([
    prisma.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } }),
    prisma.address.update({ where: { id }, data: { isDefault: true } }),
  ]);
  return listAddresses(userId);
}

/** Bila alamat utama dihapus, alamat tertua berikutnya menjadi alamat utama. */
export async function deleteAddress(userId: string, id: string): Promise<AccountAddress[]> {
  const address = await ownAddress(userId, id);
  await prisma.$transaction(async (tx) => {
    await tx.address.delete({ where: { id } });
    if (!address.isDefault) return;
    const next = await tx.address.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
  });
  return listAddresses(userId);
}

// ─── Riwayat pesanan ────────────────────────────────────────────────────────

export async function listMyOrders(userId: string, page: number): Promise<AccountOrderList> {
  const pageSize = PAGINATION.DEFAULT_PAGE_SIZE;
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { items: { select: { productName: true, quantity: true } } },
    }),
    prisma.order.count({ where: { userId } }),
  ]);
  return {
    items: orders.map((o) => ({
      orderNumber: o.orderNumber,
      status: o.status,
      createdAt: o.createdAt.toISOString(),
      total: o.total,
      itemCount: o.items.reduce((sum, i) => sum + i.quantity, 0),
      firstItemName: o.items[0]?.productName ?? '',
      courier: o.courier,
      trackingNumber: o.trackingNumber,
    })),
    page,
    pageSize,
    total,
  };
}

// ─── Profil & hapus akun ────────────────────────────────────────────────────

export async function updateProfile(userId: string, input: ProfileInput): Promise<AuthUser> {
  const user = await prisma.user.update({ where: { id: userId }, data: input });
  return toAuthUser(user);
}

/**
 * Hapus akun (UU PDP). Alamat dan keranjang ikut terhapus (cascade). Catatan pesanan tetap
 * disimpan sebagai bukti transaksi, tetapi dilepas dari akun (userId = null).
 */
export async function deleteAccount(userId: string, password: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw HttpError.unauthorized();
  if (user.role !== 'CUSTOMER') {
    throw HttpError.forbidden('Akun admin tidak bisa dihapus dari halaman ini');
  }
  if (!(await verifyPassword(user.passwordHash, password))) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Password salah');
  }
  const active = await prisma.order.count({
    where: { userId, status: { in: ACTIVE_STATUSES } },
  });
  if (active > 0) {
    throw HttpError.conflict(
      'Masih ada pesanan yang berjalan. Akun bisa dihapus setelah semua pesanan diterima atau dibatalkan.',
      'ACTIVE_ORDERS',
    );
  }
  await prisma.user.delete({ where: { id: userId } });
}

// ─── Buat akun dari pesanan tamu (F-08) ─────────────────────────────────────

/**
 * Nama, email, dan HP diambil dari pesanan; pembeli cukup membuat password. Pemegang token
 * pesanan dianggap pemilik email itu (token hanya dikirim ke email dan halaman pesanannya).
 * Alamat kirim pesanan disimpan sebagai alamat utama.
 */
export async function createAccountFromOrder(
  orderNumber: string,
  token: string,
  password: string,
): Promise<SessionUser> {
  const order = await prisma.order.findUnique({ where: { orderNumber } });
  if (!order || !tokenMatches(order.accessToken, token)) {
    throw HttpError.notFound('Pesanan tidak ditemukan');
  }
  if (order.userId)
    throw HttpError.conflict('Pesanan ini sudah terhubung ke akun', 'ALREADY_LINKED');
  if (!PAID_STATUSES.includes(order.status)) {
    throw HttpError.conflict('Akun bisa dibuat setelah pesanan dibayar', 'ORDER_NOT_PAID');
  }
  if (
    await prisma.user.findUnique({ where: { email: order.customerEmail }, select: { id: true } })
  ) {
    throw HttpError.conflict(
      `Email ${order.customerEmail} sudah terdaftar. Silakan masuk.`,
      'EMAIL_TAKEN',
    );
  }

  const passwordHash = await hashPassword(password);
  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: order.customerName,
          email: order.customerEmail,
          phone: order.customerPhone,
          passwordHash,
        },
      });
      // Compare-and-set: dua klik bersamaan tidak menghubungkan pesanan ke dua akun.
      const { count } = await tx.order.updateMany({
        where: { id: order.id, userId: null },
        data: { userId: created.id },
      });
      if (count === 0) {
        throw HttpError.conflict('Pesanan ini sudah terhubung ke akun', 'ALREADY_LINKED');
      }
      await insertAddress(tx, created.id, {
        label: null,
        recipientName: order.shippingRecipient,
        phone: order.shippingPhone,
        street: order.shippingStreet,
        districtId: order.shippingDistrictId,
        postalCode: order.shippingPostalCode,
      });
      return created;
    });
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
      throw HttpError.conflict(
        `Email ${order.customerEmail} sudah terdaftar. Silakan masuk.`,
        'EMAIL_TAKEN',
      );
    }
    throw err;
  }
}
