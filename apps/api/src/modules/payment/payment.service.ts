import { randomInt } from 'node:crypto';
import { ErrorCode, PAYMENT_WINDOW, type PaymentSession } from '@sportswear/shared';
import { z } from 'zod';
import { env } from '../../config/env.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  DokuError,
  checkoutScriptUrl,
  createCheckoutPayment,
  getCheckoutStatus,
  verifyNotificationSignature,
  type NotificationHeaders,
} from '../../lib/doku.js';
import { HttpError } from '../../lib/http-error.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { getOrderForViewer, type OrderViewer } from '../order/order.service.js';
import { transitionOrder } from '../order/order.transition.js';

const MINUTE_MS = 60_000;
/** Sisa waktu minimal agar sesi pembayaran lama masih layak dipakai ulang. */
const REUSE_MARGIN_MS = 5 * MINUTE_MS;
const DOKU_MARGIN_MS = PAYMENT_WINDOW.DOKU_MARGIN_MINUTES * MINUTE_MS;
const MIN_REMAINING_TO_START_MS = PAYMENT_WINDOW.MIN_REMAINING_TO_START_MINUTES * MINUTE_MS;
/** Jeda minimal antar cek status ke DOKU untuk satu invoice (polling halaman pesanan). */
const STATUS_CHECK_INTERVAL_SECONDS = 10;
const INVOICE_SUFFIX_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function invoiceNumberFor(orderNumber: string): string {
  let suffix = '';
  for (let i = 0; i < 4; i++)
    suffix += INVOICE_SUFFIX_ALPHABET[randomInt(INVOICE_SUFFIX_ALPHABET.length)];
  // Maks. 30 karakter (batas DOKU untuk kartu kredit), mis. 3ON-261001-K7Q2M9-AB12.
  return `${orderNumber}-${suffix}`;
}

function notPayable(message: string): HttpError {
  return HttpError.conflict(message, ErrorCode.ORDER_NOT_PAYABLE);
}

/**
 * Sesi pembayaran DOKU Checkout untuk order pending. Sesi yang masih berlaku dipakai ulang;
 * bila tidak, dibuat invoice baru (mis. pembeli menutup pop-up lalu bayar lagi).
 */
export async function startPayment(
  orderNumber: string,
  viewer: OrderViewer,
  now = new Date(),
): Promise<PaymentSession> {
  const view = await getOrderForViewer(orderNumber, viewer);
  if (view.status !== 'pending') throw notPayable('Pesanan ini tidak sedang menunggu pembayaran');

  const order = await prisma.order.findUniqueOrThrow({
    where: { id: view.id },
    select: {
      id: true,
      total: true,
      userId: true,
      accessToken: true,
      expiresAt: true,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
    },
  });
  const remainingMs = order.expiresAt.getTime() - now.getTime();

  const reusable = await prisma.payment.findFirst({
    where: {
      orderId: order.id,
      status: 'PENDING',
      amount: order.total,
      paymentUrl: { not: null },
      expiresAt: { gt: new Date(now.getTime() + REUSE_MARGIN_MS) },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (reusable?.paymentUrl && reusable.expiresAt) {
    return {
      paymentUrl: reusable.paymentUrl,
      checkoutScriptUrl: checkoutScriptUrl(),
      expiresAt: reusable.expiresAt.toISOString(),
    };
  }

  // Sesi baru hanya bila masih cukup waktu; halaman bayar DOKU ditutup sebelum order expired,
  // agar pembeli tidak bisa membayar order yang stoknya sudah dikembalikan.
  if (remainingMs < MIN_REMAINING_TO_START_MS) {
    throw notPayable(
      'Waktu pembayaran pesanan ini hampir habis, jadi pesanan tidak bisa dibayar lagi.',
    );
  }
  const dueMinutes = Math.floor((remainingMs - DOKU_MARGIN_MS) / MINUTE_MS);
  const expiresAt = new Date(now.getTime() + dueMinutes * MINUTE_MS);
  const payment = await prisma.payment.create({
    data: {
      orderId: order.id,
      invoiceNumber: invoiceNumberFor(orderNumber),
      amount: order.total,
      status: 'PENDING',
      expiresAt,
    },
  });

  try {
    const checkout = await createCheckoutPayment({
      invoiceNumber: payment.invoiceNumber,
      amount: order.total,
      dueMinutes,
      customer: {
        ...(order.userId && { id: order.userId }),
        name: order.customerName,
        email: order.customerEmail,
        phone: order.customerPhone,
      },
      callbackUrl: `${env.WEB_URL}/pesanan/${encodeURIComponent(orderNumber)}?token=${encodeURIComponent(order.accessToken)}`,
      ...(env.DOKU_NOTIFICATION_URL && { notificationUrl: env.DOKU_NOTIFICATION_URL }),
    });
    await prisma.payment.update({ where: { id: payment.id }, data: { paymentUrl: checkout.url } });
    return {
      paymentUrl: checkout.url,
      checkoutScriptUrl: checkoutScriptUrl(),
      expiresAt: expiresAt.toISOString(),
    };
  } catch (err) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
    if (err instanceof DokuError) {
      throw new HttpError(
        502,
        ErrorCode.PAYMENT_UNAVAILABLE,
        'Halaman pembayaran gagal dibuat. Coba lagi beberapa saat lagi.',
      );
    }
    throw err;
  }
}

/** Hasil pembayaran dari webhook atau cek status, sudah dinormalisasi. */
export interface PaymentResult {
  status: string;
  /** Nominal dari DOKU; QRIS mengirim desimal (mis. 20000.00). */
  amount: number;
  method: string | null;
  raw: Prisma.InputJsonValue;
  source: 'webhook' | 'status-check';
}

export type ApplyOutcome =
  | 'paid'
  | 'already-paid'
  | 'paid-but-order-closed'
  | 'amount-mismatch'
  | 'failed'
  | 'expired'
  | 'recorded';

/**
 * Menerapkan hasil pembayaran secara idempotent. Hanya hasil dari sumber terverifikasi
 * (webhook bersignature valid atau cek status ke API DOKU) yang boleh memanggil ini.
 */
export async function applyPaymentResult(
  invoiceNumber: string,
  result: PaymentResult,
  now = new Date(),
): Promise<ApplyOutcome> {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { invoiceNumber },
      include: { order: { select: { id: true, status: true, total: true, orderNumber: true } } },
    });
    if (!payment) throw HttpError.notFound('Invoice tidak dikenal');

    // Payload mentah selalu disimpan untuk audit.
    await tx.payment.update({ where: { id: payment.id }, data: { rawPayload: result.raw } });

    if (payment.status === 'SUCCESS') return 'already-paid';

    const status = result.status.toUpperCase();
    if (status === 'SUCCESS') {
      if (result.amount !== payment.amount || payment.amount !== payment.order.total) {
        logger.error(
          {
            invoiceNumber,
            notified: result.amount,
            expected: payment.amount,
            orderTotal: payment.order.total,
          },
          'Nominal pembayaran DOKU tidak cocok; order TIDAK ditandai lunas',
        );
        return 'amount-mismatch';
      }

      // Compare-and-set: notifikasi ganda yang datang bersamaan hanya diproses sekali.
      const { count } = await tx.payment.updateMany({
        where: { id: payment.id, status: { not: 'SUCCESS' } },
        data: { status: 'SUCCESS', paidAt: now, paymentMethod: result.method },
      });
      if (count === 0) return 'already-paid';

      if (payment.order.status === 'pending') {
        await transitionOrder(payment.order.id, 'paid', {
          tx,
          now,
          note: `Dibayar via DOKU${result.method ? ` (${result.method})` : ''}, sumber: ${result.source}`,
        });
        return 'paid';
      }
      if (payment.order.status === 'expired' || payment.order.status === 'cancelled') {
        // Uang masuk tapi order sudah ditutup (stok sudah dikembalikan): perlu tindakan admin.
        logger.error(
          {
            invoiceNumber,
            orderNumber: payment.order.orderNumber,
            orderStatus: payment.order.status,
          },
          'Pembayaran sukses untuk order yang sudah ditutup; perlu ditangani manual (refund/proses ulang)',
        );
        return 'paid-but-order-closed';
      }
      return 'already-paid';
    }

    if (status === 'FAILED') {
      await tx.payment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: { status: 'FAILED', paymentMethod: result.method },
      });
      return 'failed';
    }

    if (status === 'EXPIRED' || status === 'TIMEOUT') {
      await tx.payment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: { status: 'EXPIRED' },
      });
      return 'expired';
    }

    return 'recorded';
  });
}

const notificationSchema = z.looseObject({
  order: z.looseObject({
    invoice_number: z.string().min(1),
    amount: z.union([z.number(), z.string()]),
  }),
  transaction: z.looseObject({ status: z.string().min(1) }),
  channel: z.looseObject({ id: z.string() }).optional(),
});

/** Notifikasi DOKU: verifikasi signature dulu, baru proses. */
export async function handleDokuNotification(
  rawBody: Buffer,
  headers: NotificationHeaders,
  target: string,
): Promise<ApplyOutcome> {
  if (!verifyNotificationSignature(headers, rawBody, target)) {
    logger.warn(
      { requestId: headers.requestId, clientId: headers.clientId, target },
      'Notifikasi DOKU ditolak: signature tidak valid',
    );
    throw HttpError.unauthorized('Signature tidak valid');
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw HttpError.badRequest('Body notifikasi bukan JSON');
  }
  const notification = notificationSchema.parse(json);

  const outcome = await applyPaymentResult(notification.order.invoice_number, {
    status: notification.transaction.status,
    amount: Number(notification.order.amount),
    method: notification.channel?.id ?? null,
    raw: json as Prisma.InputJsonValue,
    source: 'webhook',
  });
  logger.info(
    {
      invoiceNumber: notification.order.invoice_number,
      status: notification.transaction.status,
      outcome,
    },
    'Notifikasi DOKU diproses',
  );
  return outcome;
}

/**
 * Cadangan bila webhook terlambat: halaman pesanan memanggil ini saat polling. Dibatasi
 * satu cek ke DOKU per invoice setiap STATUS_CHECK_INTERVAL_SECONDS.
 */
export async function refreshPaymentStatus(
  orderNumber: string,
  viewer: OrderViewer,
): Promise<void> {
  const view = await getOrderForViewer(orderNumber, viewer);
  if (view.status !== 'pending') return;

  const latest = await prisma.payment.findFirst({
    where: { orderId: view.id, status: 'PENDING', paymentUrl: { not: null } },
    orderBy: { createdAt: 'desc' },
    select: { invoiceNumber: true },
  });
  if (!latest) return;

  try {
    const acquired = await redis.set(
      `doku-status:${latest.invoiceNumber}`,
      '1',
      'EX',
      STATUS_CHECK_INTERVAL_SECONDS,
      'NX',
    );
    if (acquired !== 'OK') return;
  } catch (err) {
    logger.warn({ err }, 'Redis tidak tersedia; cek status DOKU dilewati');
    return;
  }

  try {
    const status = await getCheckoutStatus(latest.invoiceNumber);
    if (!['SUCCESS', 'FAILED', 'EXPIRED', 'TIMEOUT'].includes(status.status)) return;
    await applyPaymentResult(latest.invoiceNumber, {
      status: status.status,
      amount: status.amount,
      method: status.channel,
      raw: (status.raw ?? {}) as Prisma.InputJsonValue,
      source: 'status-check',
    });
  } catch (err) {
    // Pembeli belum memilih metode bayar, DOKU belum mengenal invoice: wajar, coba lagi nanti.
    if (err instanceof DokuError) return;
    throw err;
  }
}
