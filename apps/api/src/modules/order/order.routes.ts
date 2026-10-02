import { Router } from 'express';
import { createRateLimiter } from '../../middleware/rate-limit.js';
import { getOrder, postCheckoutQuote, postOrder } from './order.controller.js';

const MINUTE = 60 * 1000;

export function createCheckoutRouter(): Router {
  const router = Router();

  // Hitung ongkir/total memakai kuota RajaOngkir: maks. 60 per 10 menit per IP.
  const quoteLimiter = createRateLimiter({
    name: 'checkout-quote',
    windowMs: 10 * MINUTE,
    limit: 60,
    message: 'Terlalu banyak permintaan ongkir. Tunggu sebentar lalu coba lagi.',
  });

  // Buat order: maks. 10 per 15 menit per IP.
  const orderLimiter = createRateLimiter({
    name: 'checkout-order',
    windowMs: 15 * MINUTE,
    limit: 10,
    message: 'Terlalu banyak percobaan checkout. Coba lagi dalam 15 menit.',
  });

  router.post('/checkout/quote', quoteLimiter, postCheckoutQuote);
  router.post('/orders', orderLimiter, postOrder);
  router.get('/orders/:orderNumber', getOrder);

  return router;
}
