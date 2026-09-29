import { Router } from 'express';
import { clientIp, createRateLimiter } from '../../middleware/rate-limit.js';
import { adminLogin, login, logout, me, register } from './auth.controller.js';
import { requireAuth } from './auth.middleware.js';

const MINUTE = 60 * 1000;

export function createAuthRouter(): Router {
  const router = Router();

  // Maks. 5 login gagal per 15 menit untuk kombinasi IP + email (customer & admin).
  const loginLimiter = createRateLimiter({
    name: 'login',
    windowMs: 15 * MINUTE,
    limit: 5,
    countFailedOnly: true,
    message: 'Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit.',
    keyGenerator: (req) => {
      const body: unknown = req.body;
      const email =
        typeof body === 'object' &&
        body !== null &&
        'email' in body &&
        typeof body.email === 'string'
          ? body.email.trim().toLowerCase()
          : '';
      return `${clientIp(req)}:${email}`;
    },
  });

  // Maks. 5 pendaftaran per jam per IP.
  const registerLimiter = createRateLimiter({
    name: 'register',
    windowMs: 60 * MINUTE,
    limit: 5,
    message: 'Terlalu banyak pendaftaran dari jaringan ini. Coba lagi nanti.',
  });

  router.post('/register', registerLimiter, register);
  router.post('/login', loginLimiter, login);
  // Limiter yang sama: percobaan di dua halaman login dihitung bersama.
  router.post('/admin/login', loginLimiter, adminLogin);
  router.post('/logout', logout);
  router.get('/me', requireAuth, me);

  return router;
}
