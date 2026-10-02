/**
 * Job complete-order (F-16): pesanan `delivered` menjadi `completed` setelah
 * ORDER_AUTO_COMPLETE_DAYS hari. Tidak ada fitur komplain di MVP, jadi tanpa pengecualian.
 */
import { ErrorCode, ORDER_AUTO_COMPLETE_DAYS } from '@sportswear/shared';
import { HttpError } from '../lib/http-error.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { transitionOrder } from '../modules/order/order.transition.js';

const BATCH_SIZE = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function completeDeliveredOrders(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - ORDER_AUTO_COMPLETE_DAYS * DAY_MS);
  const due = await prisma.order.findMany({
    where: { status: 'delivered', deliveredAt: { lte: cutoff } },
    orderBy: { deliveredAt: 'asc' },
    take: BATCH_SIZE,
    select: { id: true, orderNumber: true },
  });

  let completed = 0;
  for (const order of due) {
    try {
      await transitionOrder(order.id, 'completed', {
        now,
        note: `Selesai otomatis ${ORDER_AUTO_COMPLETE_DAYS} hari setelah diterima`,
      });
      completed++;
    } catch (err) {
      // Diubah di saat yang sama oleh proses lain: bukan error.
      if (err instanceof HttpError && err.code === ErrorCode.INVALID_TRANSITION) continue;
      logger.error({ err, orderNumber: order.orderNumber }, 'Gagal menyelesaikan order');
    }
  }
  if (completed) logger.info({ completed }, 'Job complete-order selesai');
  return completed;
}
