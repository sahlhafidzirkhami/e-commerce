'use client';

import type { ApiError } from '@sportswear/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

type Mode = 'login' | 'register' | 'admin';

const ENDPOINT: Record<Mode, string> = {
  login: '/api/auth/login',
  register: '/api/auth/register',
  admin: '/api/auth/admin/login',
};

const inputClass =
  'w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900';

export function AuthForm({ mode, next }: { mode: Mode; next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(
      [...form.entries()].filter(([, value]) => typeof value === 'string' && value.trim() !== ''),
    );

    try {
      const res = await fetch(ENDPOINT[mode], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as ApiError | null;
        setError(body?.error.message ?? 'Terjadi kesalahan. Coba lagi.');
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError('Tidak dapat terhubung ke server. Periksa koneksi internet.');
    } finally {
      setPending(false);
    }
  }

  const isLogin = mode !== 'register';

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {!isLogin && (
        <label className="block space-y-1">
          <span className="text-sm font-medium">Nama lengkap</span>
          <input name="name" autoComplete="name" required className={inputClass} />
        </label>
      )}

      <label className="block space-y-1">
        <span className="text-sm font-medium">Email</span>
        <input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          className={inputClass}
        />
      </label>

      {!isLogin && (
        <label className="block space-y-1">
          <span className="text-sm font-medium">
            Nomor HP <span className="font-normal text-neutral-500">(opsional)</span>
          </span>
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="081234567890"
            className={inputClass}
          />
        </label>
      )}

      <label className="block space-y-1">
        <span className="text-sm font-medium">Password</span>
        <input
          name="password"
          type="password"
          autoComplete={isLogin ? 'current-password' : 'new-password'}
          minLength={isLogin ? undefined : 8}
          required
          className={inputClass}
        />
        {!isLogin && <span className="text-xs text-neutral-500">Minimal 8 karakter</span>}
      </label>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-neutral-900 px-4 py-3 font-semibold text-white disabled:opacity-60"
      >
        {pending ? 'Memproses…' : isLogin ? 'Masuk' : 'Daftar'}
      </button>

      {/* Akun admin hanya dibuat oleh OWNER, jadi login admin tidak punya link daftar. */}
      {mode !== 'admin' && (
        <p className="text-center text-sm text-neutral-600">
          {isLogin ? 'Belum punya akun? ' : 'Sudah punya akun? '}
          <Link
            href={`${isLogin ? '/daftar' : '/masuk'}?next=${encodeURIComponent(next)}`}
            className="font-semibold text-neutral-900 underline"
          >
            {isLogin ? 'Daftar' : 'Masuk'}
          </Link>
        </p>
      )}
    </form>
  );
}
