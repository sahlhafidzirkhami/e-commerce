import { Router } from 'express';
import { createRateLimiter } from '../../middleware/rate-limit.js';
import { requireAuth } from '../auth/auth.middleware.js';
import {
  getAddresses,
  getMyOrders,
  postAccountFromOrder,
  postAddress,
  postDefaultAddress,
  putAddress,
  putProfile,
  removeAccount,
  removeAddress,
} from './account.controller.js';

const MINUTE = 60 * 1000;

/** /api — akun pembeli (F-08, F-18). */
export function createAccountRouter(): Router {
  const router = Router();

  // Sama dengan pendaftaran biasa: maks. 5 per jam per IP.
  const registerLimiter = createRateLimiter({
    name: 'register-from-order',
    windowMs: 60 * MINUTE,
    limit: 5,
    message: 'Terlalu banyak pendaftaran dari jaringan ini. Coba lagi nanti.',
  });
  // Hapus akun memeriksa password: dibatasi seperti login.
  const deleteLimiter = createRateLimiter({
    name: 'delete-account',
    windowMs: 15 * MINUTE,
    limit: 5,
    countFailedOnly: true,
    message: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.',
  });

  router.post('/orders/:orderNumber/account', registerLimiter, postAccountFromOrder);

  router.get('/account/orders', requireAuth, getMyOrders);
  router.get('/account/addresses', requireAuth, getAddresses);
  router.post('/account/addresses', requireAuth, postAddress);
  router.put('/account/addresses/:id', requireAuth, putAddress);
  router.post('/account/addresses/:id/default', requireAuth, postDefaultAddress);
  router.delete('/account/addresses/:id', requireAuth, removeAddress);
  router.put('/account/profile', requireAuth, putProfile);
  router.delete('/account', requireAuth, deleteLimiter, removeAccount);

  return router;
}
