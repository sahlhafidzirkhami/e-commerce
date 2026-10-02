import {
  ErrorCode,
  STOCK_RELEASING_STATUSES,
  canTransition,
  type OrderStatus,
} from '@sportswear/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { HttpError } from '../../lib/http-error.js';
import { prisma } from '../../lib/prisma.js';
import { releaseVoucherQuota } from '../voucher/voucher.service.js';

export interface TransitionOptions {
  note?: string;
  /** User yang mengubah status (admin); kosong untuk sistem (webhook, job). */
  changedById?: string;
  /** Pakai transaksi yang sedang berjalan, mis. dari webhook. */
  tx?: Prisma.TransactionClient;
  now?: Date;
}

const TIMESTAMP_FIELD: Partial<Record<OrderStatus, keyof Prisma.OrderUpdateManyMutationInput>> = {
  paid: 'paidAt',
  shipped: 'shippedAt',
  delivered: 'deliveredAt',
  completed: 'completedAt',
  cancelled: 'cancelledAt',
};

export interface TransitionResult {
  from: OrderStatus;
  to: OrderStatus;
}

async function run(
  tx: Prisma.TransactionClient,
  orderId: string,
  to: OrderStatus,
  options: TransitionOptions,
): Promise<TransitionResult> {
  const now = options.now ?? new Date();
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      voucherId: true,
      items: { select: { variantId: true, quantity: true } },
    },
  });
  if (!order) throw HttpError.notFound('Pesanan tidak ditemukan');

  const from = order.status;
  if (!canTransition(from, to)) {
    throw HttpError.conflict(
      `Status pesanan tidak bisa diubah dari ${from} ke ${to}`,
      ErrorCode.INVALID_TRANSITION,
    );
  }

  // Compare-and-set: bila proses lain sudah mengubah status lebih dulu, batalkan.
  const timestampField = TIMESTAMP_FIELD[to];
  const { count } = await tx.order.updateMany({
    where: { id: orderId, status: from },
    data: { status: to, ...(timestampField && { [timestampField]: now }) },
  });
  if (count !== 1) {
    throw HttpError.conflict(
      'Status pesanan baru saja berubah, muat ulang lalu coba lagi',
      ErrorCode.INVALID_TRANSITION,
    );
  }

  await tx.orderStatusHistory.create({
    data: {
      orderId,
      fromStatus: from,
      toStatus: to,
      note: options.note ?? null,
      changedById: options.changedById ?? null,
      createdAt: now,
    },
  });

  if (STOCK_RELEASING_STATUSES.includes(to)) {
    for (const item of order.items) {
      // Varian yang sudah dihapus (variantId null) tidak punya stok untuk dikembalikan.
      if (!item.variantId) continue;
      await tx.productVariant.updateMany({
        where: { id: item.variantId },
        data: { stock: { increment: item.quantity } },
      });
    }
    if (order.voucherId) await releaseVoucherQuota(tx, order.voucherId);
  }

  return { from, to };
}

/**
 * Satu-satunya pintu perubahan status order: menolak transisi tidak valid, mencatat
 * OrderStatusHistory, dan mengembalikan stok serta kuota voucher saat expired/cancelled.
 */
export function transitionOrder(
  orderId: string,
  to: OrderStatus,
  options: TransitionOptions = {},
): Promise<TransitionResult> {
  if (options.tx) return run(options.tx, orderId, to, options);
  return prisma.$transaction((tx) => run(tx, orderId, to, options));
}
