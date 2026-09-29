import { SESSION_COOKIE_NAME, type AuthUser } from '@sportswear/shared';
import { cookies } from 'next/headers';

const apiUrl = process.env.API_URL ?? 'http://localhost:4000';

/** Hanya untuk Server Component / route handler: user yang sedang login, atau null. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const res = await fetch(`${apiUrl}/api/auth/me`, {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;

  const body = (await res.json()) as { data: { user: AuthUser } };
  return body.data.user;
}

/** Hanya izinkan redirect ke path internal (cegah open redirect ke domain lain). */
export function safeNextPath(next: string | string[] | undefined, fallback = '/'): string {
  const value = Array.isArray(next) ? next[0] : next;
  return value && value.startsWith('/') && !value.startsWith('//') ? value : fallback;
}
