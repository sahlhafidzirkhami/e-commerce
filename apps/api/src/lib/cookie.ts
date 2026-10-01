import type { CookieOptions } from 'express';
import { env } from '../config/env.js';

/** Opsi dasar semua cookie API: tidak bisa dibaca JavaScript, HTTPS di production. */
export const baseCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
};
