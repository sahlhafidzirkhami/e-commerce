import express, { Router } from 'express';
import { createRateLimiter } from '../../middleware/rate-limit.js';
import { postDokuWebhook, postPayment, postPaymentCheck } from './payment.controller.js';

const MINUTE = 60 * 1000;

export const DOKU_WEBHOOK_PATH = '/api/webhooks/doku';

/** Webhook dipasang sebelum express.json: verifikasi signature butuh body mentah. */
export function createDokuWebhookRouter(): Router {
  const router = Router();
  router.post(
    DOKU_WEBHOOK_PATH,
    express.raw({ type: () => true, limit: '256kb' }),
    postDokuWebhook,
  );
  return router;
}

export function createPaymentRouter(): Router {
  const router = Router();

  // Membuat sesi bayar memanggil DOKU: maks. 10 per 10 menit per IP.
  const paymentLimiter = createRateLimiter({
    name: 'payment-start',
    windowMs: 10 * MINUTE,
    limit: 10,
    message: 'Terlalu banyak percobaan pembayaran. Tunggu sebentar lalu coba lagi.',
  });

  // Polling status dari halaman pesanan (tiap ~5 detik): maks. 120 per 10 menit per IP.
  const checkLimiter = createRateLimiter({
    name: 'payment-check',
    windowMs: 10 * MINUTE,
    limit: 120,
    message: 'Terlalu banyak permintaan. Muat ulang halaman sebentar lagi.',
  });

  router.post('/orders/:orderNumber/payment', paymentLimiter, postPayment);
  router.post('/orders/:orderNumber/payment/check', checkLimiter, postPaymentCheck);

  return router;
}
