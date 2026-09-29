import { SESSION_TTL_DAYS } from '@sportswear/shared';
import { SignJWT, jwtVerify } from 'jose';
import { env } from '../../config/env.js';

const secret = new TextEncoder().encode(env.JWT_SECRET);
const ALGORITHM = 'HS256';

export interface SessionClaims {
  userId: string;
  tokenVersion: number;
}

export function signSessionToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({ ver: claims.tokenVersion })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(claims.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_DAYS}d`)
    .sign(secret);
}

/** null bila token rusak, kedaluwarsa, atau ditandatangani kunci lain. */
export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: [ALGORITHM] });
    if (typeof payload.sub !== 'string' || typeof payload.ver !== 'number') return null;
    return { userId: payload.sub, tokenVersion: payload.ver };
  } catch {
    return null;
  }
}
