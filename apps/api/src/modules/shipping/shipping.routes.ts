import { Router } from 'express';
import { createRateLimiter } from '../../middleware/rate-limit.js';
import { getCities, getDistricts, getProvinces, postShippingRates } from './shipping.controller.js';

const MINUTE = 60 * 1000;

export function createShippingRouter(): Router {
  const router = Router();

  // Daftar kecamatan kota baru memakai kuota RajaOngkir: maks. 30 per 10 menit per IP.
  const districtLimiter = createRateLimiter({
    name: 'regions-district',
    windowMs: 10 * MINUTE,
    limit: 30,
    message: 'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.',
  });

  // Cek ongkir (CLAUDE.md: wajib rate limit): maks. 30 per 10 menit per IP.
  const ratesLimiter = createRateLimiter({
    name: 'shipping-rates',
    windowMs: 10 * MINUTE,
    limit: 30,
    message: 'Terlalu banyak cek ongkir. Tunggu sebentar lalu coba lagi.',
  });

  router.get('/regions/provinces', getProvinces);
  router.get('/regions/provinces/:id/cities', getCities);
  router.get('/regions/cities/:id/districts', districtLimiter, getDistricts);
  router.post('/shipping/rates', ratesLimiter, postShippingRates);

  return router;
}
