/**
 * Job expire-order: order pending yang lewat batas bayar menjadi `expired` dan stoknya
 * kembali. Sebelum meng-expire, status setiap sesi bayar DOKU dicek dulu agar pembayaran
 * yang sebenarnya sudah masuk (webhook terlambat) tidak ikut dibatalkan.
 */
import { ErrorCode } from '@sportswear/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { DokuError, getCheckoutStatus, type DokuOrderStatus } from '../lib/doku.js';
import { HttpError } from '../lib/http-error.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { transitionOrder } from '../modules/order/order.transition.js';
import { applyPaymentResult } from '../modules/payment/payment.service.js';

const BATCH_SIZE = 100;
/**
 * Bila DOKU tidak bisa dihubungi, order ditunggu dulu (dicoba lagi di putaran berikutnya)
 * sampai lewat batas ini, baru di-expire tanpa konfirmasi DOKU.
 */
const MAX_WAIT_FOR_DOKU_MS = 60 * 60 * 1000;

export interface ExpireSummary {
  expired: number;
  paidLate: number;
  deferred: number;
}

type CheckStatus = (invoiceNumber: string) => Promise<DokuOrderStatus>;

/** true = boleh di-expire; 'paid' = ternyata sudah dibayar; 'defer' = coba lagi nanti. */
async function confirmUnpaid(
  orderId: string,
  checkStatus: CheckStatus,
): Promise<true | 'paid' | 'defer'> {
  const sessions = await prisma.payment.findMany({
    where: { orderId, status: 'PENDING', paymentUrl: { not: null } },
    select: { invoiceNumber: true },
  });

  let unreachable = false;
  for (const { invoiceNumber } of sessions) {
    let status: DokuOrderStatus;
    try {
      status = await checkStatus(invoiceNumber);
    } catch (err) {
      // 404: pembeli belum memilih metode bayar, DOKU belum punya transaksi. Aman di-expire.
      if (err instanceof DokuError && err.status === 404) continue;
      unreachable = true;
      continue;
    }
    if (status.status === 'SUCCESS') {
      const outcome = await applyPaymentResult(invoiceNumber, {
        status: status.status,
        amount: status.amount,
        method: status.channel,
        raw: (status.raw ?? {}) as Prisma.InputJsonValue,
        source: 'status-check',
      });
      if (outcome === 'paid' || outcome === 'already-paid') return 'paid';
    }
  }
  return unreachable ? 'defer' : true;
}

export async function expireOverdueOrders(
  now = new Date(),
  checkStatus: CheckStatus = getCheckoutStatus,
): Promise<ExpireSummary> {
  const summary: ExpireSummary = { expired: 0, paidLate: 0, deferred: 0 };
  const overdue = await prisma.order.findMany({
    where: { status: 'pending', expiresAt: { lte: now } },
    orderBy: { expiresAt: 'asc' },
    take: BATCH_SIZE,
    select: { id: true, orderNumber: true, expiresAt: true },
  });

  for (const order of overdue) {
    try {
      const check = await confirmUnpaid(order.id, checkStatus);
      if (check === 'paid') {
        summary.paidLate++;
        continue;
      }
      const overdueMs = now.getTime() - order.expiresAt.getTime();
      if (check === 'defer' && overdueMs < MAX_WAIT_FOR_DOKU_MS) {
        summary.deferred++;
        continue;
      }
      await transitionOrder(order.id, 'expired', {
        now,
        note:
          check === 'defer'
            ? 'Tidak dibayar sampai batas waktu (DOKU tidak bisa dikonfirmasi)'
            : 'Tidak dibayar sampai batas waktu',
      });
      summary.expired++;
    } catch (err) {
      // Webhook baru saja menandai lunas di saat yang sama: bukan error.
      if (err instanceof HttpError && err.code === ErrorCode.INVALID_TRANSITION) continue;
      logger.error({ err, orderNumber: order.orderNumber }, 'Gagal meng-expire order');
    }
  }

  if (summary.expired || summary.paidLate || summary.deferred) {
    logger.info(summary, 'Job expire-order selesai');
  }
  return summary;
}
