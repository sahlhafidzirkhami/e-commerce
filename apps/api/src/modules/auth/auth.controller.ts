import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_DAYS,
  isAdminRole,
  loginSchema,
  registerSchema,
} from '@sportswear/shared';
import type { CookieOptions, RequestHandler, Response } from 'express';
import { env } from '../../config/env.js';
import { HttpError } from '../../lib/http-error.js';
import { authenticate, registerUser, toAuthUser, type SessionUser } from './auth.service.js';
import { signSessionToken } from './auth.token.js';

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
};

async function startSession(res: Response, user: SessionUser) {
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

export const logout: RequestHandler = (_req, res) => {
  res.clearCookie(SESSION_COOKIE_NAME, cookieOptions);
  res.json({ data: { loggedOut: true } });
};

export const me: RequestHandler = (req, res) => {
  res.json({ data: { user: req.user } });
};
