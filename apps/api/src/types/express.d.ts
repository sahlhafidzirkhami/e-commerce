import type { AuthUser } from '@sportswear/shared';

declare global {
  namespace Express {
    interface Request {
      /** Diisi middleware loadSession bila cookie sesi valid. */
      user?: AuthUser;
    }
  }
}

export {};
