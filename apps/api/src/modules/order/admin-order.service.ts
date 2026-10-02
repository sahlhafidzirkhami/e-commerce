import {
  ORDER_STATUSES,
  type AdminOrderDetail,
  type AdminOrderListQuery,
  type AdminOrderListResult,
  type OrderStatus,
} from '@sportswear/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { enqueueOrderEmail } from '../../jobs/email-queue.js';
import { HttpError } from '../../lib/http-error.js';
import { prisma } from '../../lib/prisma.js';
import { toOrderView } from './order.service.js';
import { transitionOrder } from './order.transition.js';

function listWhere(query: AdminOrderListQuery): Prisma.OrderWhereInput {
  const q = query.q;
  return {
    ...(query.status && { status: query.status }),
    ...(q && {
      OR: [
        { orderNumber: { contains: q, mode: 'insensitive' } },
        { customerName: { contains: q, mode: 'insensitive' } },
        { customerEmail: { contains: q, mode: 'insensitive' } },
      ],
    }),
  };
}

export async function listAdminOrders(query: AdminOrderListQuery): Promise<AdminOrderListResult> {
  const where = listWhere(query);
  // Hitungan per status mengikuti pencarian, tapi tidak mengikuti filter status itu sendiri.
  const countWhere = listWhere({ ...query, status: undefined });

  const [orders, total, groups] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { items: { select: { quantity: true } } },
    }),
    prisma.order.count({ where }),
    prisma.order.groupBy({ by: ['status'], where: countWhere, _count: { _all: true } }),
  ]);

  const countsByStatus = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<
    OrderStatus,
    number
  >;
  for (const group of groups) countsByStatus[group.status] = group._count._all;

  return {
    items: orders.map((order) => ({
      orderNumber: order.orderNumber,
      status: order.status,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      total: order.total,
      courier: order.courier,
      courierService: order.courierService,
      trackingNumber: order.trackingNumber,
      createdAt: order.createdAt.toISOString(),
      paidAt: order.paidAt?.toISOString() ?? null,
    })),
    page: query.page,
    pageSize: query.pageSize,
    total,
    countsByStatus,
  };
}

async function findOrderId(orderNumber: string): Promise<string> {
  const order = await prisma.order.findUnique({ where: { orderNumber }, select: { id: true } });
  if (!order) throw HttpError.notFound('Pesanan tidak ditemukan');
  return order.id;
}

export async function getAdminOrder(orderNumber: string): Promise<AdminOrderDetail> {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      items: { orderBy: { id: 'asc' } },
      statusHistory: {
        orderBy: { createdAt: 'asc' },
        include: { changedBy: { select: { name: true } } },
      },
      payments: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!order) throw HttpError.notFound('Pesanan tidak ditemukan');

  const { id: _id, ...view } = toOrderView(order);
  return {
    ...view,
    isGuest: order.userId === null,
    totalWeightGram: order.totalWeightGram,
    history: order.statusHistory.map((h) => ({
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      note: h.note,
      changedBy: h.changedBy?.name ?? null,
      createdAt: h.createdAt.toISOString(),
    })),
    payments: order.payments.map((p) => ({
      invoiceNumber: p.invoiceNumber,
      status: p.status,
      amount: p.amount,
      method: p.paymentMethod,
      paidAt: p.paidAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    })),
  };
}

/** paid → processing: pesanan mulai dikemas. */
export async function processOrder(orderNumber: string, adminId: string): Promise<void> {
  await transitionOrder(await findOrderId(orderNumber), 'processing', {
    changedById: adminId,
    note: 'Pesanan mulai dikemas',
  });
}

/**
 * processing → shipped dengan nomor resi dari jasa kirim. Resi disimpan di transaksi yang
 * sama dengan perubahan status, agar status `shipped` tidak pernah tanpa resi.
 */
export async function shipOrder(
  orderNumber: string,
  trackingNumber: string,
  adminId: string,
): Promise<void> {
  const orderId = await findOrderId(orderNumber);
  const resi = trackingNumber.toUpperCase();
  await prisma.$transaction(async (tx) => {
    await transitionOrder(orderId, 'shipped', {
      tx,
      changedById: adminId,
      note: `Resi ${resi}`,
    });
    await tx.order.update({ where: { id: orderId }, data: { trackingNumber: resi } });
  });
  await enqueueOrderEmail('order-shipped', orderId);
}

/** shipped → delivered: ditandai manual (cek resi otomatis = future feature). */
export async function markDelivered(orderNumber: string, adminId: string): Promise<void> {
  const orderId = await findOrderId(orderNumber);
  await transitionOrder(orderId, 'delivered', {
    changedById: adminId,
    note: 'Ditandai diterima oleh admin',
  });
  await enqueueOrderEmail('order-delivered', orderId);
}

/** Batalkan pesanan; stok dan kuota voucher dikembalikan oleh transitionOrder. */
export async function cancelOrder(
  orderNumber: string,
  reason: string,
  adminId: string,
): Promise<void> {
  await transitionOrder(await findOrderId(orderNumber), 'cancelled', {
    changedById: adminId,
    note: `Dibatalkan admin: ${reason}`,
  });
}
