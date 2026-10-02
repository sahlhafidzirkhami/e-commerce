import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_DAYS,
  forgotPasswordSchema,
  isAdminRole,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '@sportswear/shared';
import type { RequestHandler, Response } from 'express';
import { baseCookieOptions as cookieOptions } from '../../lib/cookie.js';
import { HttpError } from '../../lib/http-error.js';
import { logger } from '../../lib/logger.js';
import { authenticate, registerUser, toAuthUser, type SessionUser } from './auth.service.js';
import { signSessionToken } from './auth.token.js';
import { requestPasswordReset, resetPassword } from './password-reset.service.js';

/** Dipakai juga oleh pembuatan akun dari pesanan (modul user). */
export async function startSession(res: Response, user: SessionUser) {
  const token = await signSessionToken({ userId: user.id, tokenVersion: user.tokenVersion });
  res.cookie(SESSION_COOKIE_NAME, token, {
    ...cookieOptions,
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

export const register: RequestHandler = async (req, res) => {
  const input = registerSchema.parse(req.body);
  const user = await registerUser(input);
  await startSession(res, user);
  res.status(201).json({ data: { user: toAuthUser(user) } });
};

export const login: RequestHandler = async (req, res) => {
  const input = loginSchema.parse(req.body);
  const user = await authenticate(input);
  await startSession(res, user);
  res.json({ data: { user: toAuthUser(user) } });
};

/** Login panel admin: akun non-admin ditolak dan tidak mendapat sesi. */
export const adminLogin: RequestHandler = async (req, res) => {
  const input = loginSchema.parse(req.body);
  const user = await authenticate(input);
  if (!isAdminRole(user.role)) {
    throw new HttpError(403, 'NOT_ADMIN', 'Akun ini tidak memiliki akses admin');
  }
  await startSession(res, user);
  res.json({ data: { user: toAuthUser(user) } });
};

export function endSession(res: Response) {
  res.clearCookie(SESSION_COOKIE_NAME, cookieOptions);
}

export const logout: RequestHandler = (_req, res) => {
  endSession(res);
  res.json({ data: { loggedOut: true } });
};

export const me: RequestHandler = (req, res) => {
  res.json({ data: { user: req.user } });
};

/**
 * Lupa password (F-17). Balasan selalu sama dan langsung dikirim, sebelum email diproses,
 * agar tidak bisa dipakai menebak email mana yang terdaftar (lewat isi maupun lama respons).
 */
export const forgotPassword: RequestHandler = (req, res) => {
  const { email } = forgotPasswordSchema.parse(req.body);
  void requestPasswordReset(email).catch((err: unknown) =>
    logger.error({ err }, 'Email reset password gagal dikirim'),
  );
  res.json({
    data: {
      message: 'Bila email terdaftar, tautan untuk membuat password baru sudah kami kirim.',
    },
  });
};

/** Password baru berlaku; semua sesi lama keluar, sesi baru dibuat di perangkat ini. */
export const postResetPassword: RequestHandler = async (req, res) => {
  const { token, password } = resetPasswordSchema.parse(req.body);
  const user = await resetPassword(token, password);
  await startSession(res, user);
  res.json({ data: { user: toAuthUser(user) } });
};
