import { ADMIN_ROLES, SESSION_COOKIE_NAME, type UserRole } from '@sportswear/shared';
import type { RequestHandler } from 'express';
import { HttpError } from '../../lib/http-error.js';
import { findSessionUser, toAuthUser } from './auth.service.js';
import { verifySessionToken } from './auth.token.js';

/** Mengisi req.user bila cookie sesi valid. Tidak menolak request tanpa sesi. */
export const loadSession: RequestHandler = async (req, _res, next) => {
  const token: unknown = req.cookies?.[SESSION_COOKIE_NAME];
  if (typeof token === 'string' && token) {
    const claims = await verifySessionToken(token);
    const user = claims ? await findSessionUser(claims) : null;
    if (user) req.user = toAuthUser(user);
  }
  next();
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  next(req.user ? undefined : HttpError.unauthorized());
};

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(HttpError.unauthorized());
    if (!roles.includes(req.user.role)) return next(HttpError.forbidden());
    next();
  };
}

/** Untuk semua endpoint admin. */
export const requireAdmin: RequestHandler = requireRole(...ADMIN_ROLES);

/** Hanya OWNER: pengaturan toko dan manajemen admin. */
export const requireOwner: RequestHandler = requireRole('OWNER');
