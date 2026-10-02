import { Router, type Request } from 'express';
import { clientIp, createRateLimiter } from '../../middleware/rate-limit.js';
import {
  adminLogin,
  forgotPassword,
  login,
  logout,
  me,
  postResetPassword,
  register,
} from './auth.controller.js';
import { requireAuth } from './auth.middleware.js';

const MINUTE = 60 * 1000;

/** Kunci rate limit per kombinasi IP + email di body. */
function ipAndEmail(req: Request): string {
  const body: unknown = req.body;
  const email =
    typeof body === 'object' && body !== null && 'email' in body && typeof body.email === 'string'
      ? body.email.trim().toLowerCase()
      : '';
  return `${clientIp(req)}:${email}`;
}

export function createAuthRouter(): Router {
  const router = Router();

  // Maks. 5 login gagal per 15 menit untuk kombinasi IP + email (customer & admin).
  const loginLimiter = createRateLimiter({
    name: 'login',
    windowMs: 15 * MINUTE,
    limit: 5,
    countFailedOnly: true,
    message: 'Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit.',
    keyGenerator: ipAndEmail,
  });

  // Maks. 5 pendaftaran per jam per IP.
  const registerLimiter = createRateLimiter({
    name: 'register',
    windowMs: 60 * MINUTE,
    limit: 5,
    message: 'Terlalu banyak pendaftaran dari jaringan ini. Coba lagi nanti.',
  });

  // Maks. 3 permintaan reset per 15 menit untuk kombinasi IP + email (cegah spam email).
  const forgotLimiter = createRateLimiter({
    name: 'forgot-password',
    windowMs: 15 * MINUTE,
    limit: 3,
    message: 'Terlalu banyak permintaan. Coba lagi dalam 15 menit.',
    keyGenerator: ipAndEmail,
  });
  const resetLimiter = createRateLimiter({
    name: 'reset-password',
    windowMs: 15 * MINUTE,
    limit: 10,
    message: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.',
  });

  router.post('/register', registerLimiter, register);
  router.post('/password/forgot', forgotLimiter, forgotPassword);
  router.post('/password/reset', resetLimiter, postResetPassword);
  router.post('/login', loginLimiter, login);
  // Limiter yang sama: percobaan di dua halaman login dihitung bersama.
  router.post('/admin/login', loginLimiter, adminLogin);
  router.post('/logout', logout);
  router.get('/me', requireAuth, me);

  return router;
}
