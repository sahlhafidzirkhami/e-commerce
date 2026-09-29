import type { AuthUser, LoginInput, RegisterInput, UserRole } from '@sportswear/shared';
import { HttpError } from '../../lib/http-error.js';
import { hashPassword, verifyAgainstDummy, verifyPassword } from '../../lib/password.js';
import { prisma } from '../../lib/prisma.js';
import type { SessionClaims } from './auth.token.js';

export interface SessionUser extends AuthUser {
  tokenVersion: number;
}

interface UserRecord {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  tokenVersion: number;
}

function toSessionUser(user: UserRecord): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    tokenVersion: user.tokenVersion,
  };
}

export function toAuthUser(user: SessionUser): AuthUser {
  const { tokenVersion: _tokenVersion, ...authUser } = user;
  return authUser;
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002';
}

export async function registerUser(input: RegisterInput): Promise<SessionUser> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw HttpError.conflict('Email sudah terdaftar', 'EMAIL_TAKEN');

  try {
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        passwordHash: await hashPassword(input.password),
      },
    });
    return toSessionUser(user);
  } catch (err) {
    // Dua pendaftaran bersamaan dengan email yang sama.
    if (isUniqueViolation(err)) throw HttpError.conflict('Email sudah terdaftar', 'EMAIL_TAKEN');
    throw err;
  }
}

export async function authenticate(input: LoginInput): Promise<SessionUser> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const valid = user
    ? await verifyPassword(user.passwordHash, input.password)
    : await verifyAgainstDummy(input.password);

  if (!user || !valid) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email atau password salah');
  }
  return toSessionUser(user);
}

/** User pemilik sesi, atau null bila user dihapus / tokenVersion sudah dinaikkan. */
export async function findSessionUser(claims: SessionClaims): Promise<SessionUser | null> {
  const user = await prisma.user.findFirst({
    where: { id: claims.userId, tokenVersion: claims.tokenVersion },
  });
  return user ? toSessionUser(user) : null;
}
