'use client';

import type { AuthUser } from '@sportswear/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCart } from './cart/cart-provider';
import { buttonClass } from './ui/styles';

type State = { status: 'loading' } | { status: 'guest' } | { status: 'user'; user: AuthUser };

/**
 * Status akun di header toko. Dimuat di browser agar halaman toko tetap bisa
 * di-cache (statis) — tidak membaca cookie di server.
 */
export function HeaderAccount() {
  const router = useRouter();
  const { reload: reloadCart } = useCart();
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
    // Keranjang akun tidak boleh tetap tampil setelah keluar.
    void reloadCart();
    router.refresh();
  }

  if (state.status === 'loading') {
    return <span aria-hidden className="h-5 w-16 animate-pulse rounded bg-muted" />;
  }

  if (state.status === 'guest') {
    return (
      <nav aria-label="Akun" className="flex items-center gap-1 text-sm font-semibold">
        <Link
          href="/masuk"
          className="inline-flex min-h-11 items-center rounded-full px-3 hover:bg-muted"
        >
          Masuk
        </Link>
        {/* Di layar sempit cukup "Masuk"; halaman masuk punya tautan ke daftar. */}
        <span className="hidden sm:contents">
          <Link href="/daftar" className={buttonClass('primary', 'sm')}>
            Daftar
          </Link>
        </span>
      </nav>
    );
  }

  const firstName = state.user.name.split(' ')[0] ?? state.user.name;

  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <span className="hidden max-w-32 truncate sm:inline" title={state.user.name}>
        Hai, <span className="font-semibold">{firstName}</span>
      </span>
      <button
        type="button"
        onClick={logout}
        disabled={loggingOut}
        className="inline-flex min-h-11 shrink-0 items-center rounded-full px-3 font-semibold hover:bg-muted disabled:opacity-40"
      >
        {loggingOut ? 'Keluar…' : 'Keluar'}
      </button>
    </div>
  );
}
