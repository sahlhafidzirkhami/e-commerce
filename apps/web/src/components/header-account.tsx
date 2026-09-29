'use client';

import type { AuthUser } from '@sportswear/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type State = { status: 'loading' } | { status: 'guest' } | { status: 'user'; user: AuthUser };

/**
 * Status akun di header toko. Dimuat di browser agar halaman toko tetap bisa
 * di-cache (statis) — tidak membaca cookie di server.
 */
export function HeaderAccount() {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return null;
        const body = (await res.json()) as { data: { user: AuthUser } };
        return body.data.user;
      })
      .catch(() => null)
      .then((user) => {
        if (!cancelled) setState(user ? { status: 'user', user } : { status: 'guest' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function logout() {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    setState({ status: 'guest' });
    setLoggingOut(false);
    router.refresh();
  }

  if (state.status === 'loading') {
    return <span aria-hidden className="h-5 w-24 animate-pulse rounded bg-neutral-200" />;
  }

  if (state.status === 'guest') {
    return (
      <nav className="flex items-center gap-3 text-sm font-semibold">
        <Link href="/masuk" className="underline-offset-4 hover:underline">
          Masuk
        </Link>
        <Link href="/daftar" className="rounded-lg bg-neutral-900 px-3 py-1.5 text-white">
          Daftar
        </Link>
      </nav>
    );
  }

  const firstName = state.user.name.split(' ')[0] ?? state.user.name;

  return (
    <div className="flex min-w-0 items-center gap-3 text-sm">
      <span className="truncate" title={state.user.name}>
        Hai, <span className="font-semibold">{firstName}</span>
      </span>
      <button
        type="button"
        onClick={logout}
        disabled={loggingOut}
        className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 font-medium disabled:opacity-60"
      >
        {loggingOut ? 'Keluar…' : 'Keluar'}
      </button>
    </div>
  );
}
