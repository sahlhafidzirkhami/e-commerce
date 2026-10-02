'use client';

import type { ApiError } from '@sportswear/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { buttonClass, inputClass } from './ui/styles';

type Mode = 'login' | 'register' | 'admin';

const ENDPOINT: Record<Mode, string> = {
  login: '/api/auth/login',
  register: '/api/auth/register',
  admin: '/api/auth/admin/login',
};

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
          <span className="text-[13px] font-semibold">Nama lengkap</span>
          <input name="name" autoComplete="name" required className={inputClass} />
        </label>
      )}

      <label className="block space-y-1">
        <span className="text-[13px] font-semibold">Email</span>
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
          <span className="text-[13px] font-semibold">
            Nomor HP <span className="font-normal text-ink-2">(opsional)</span>
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
        <span className="text-[13px] font-semibold">Password</span>
        <input
          name="password"
          type="password"
          autoComplete={isLogin ? 'current-password' : 'new-password'}
          minLength={isLogin ? undefined : 8}
          required
          className={inputClass}
        />
        {!isLogin && <span className="text-xs text-ink-2">Minimal 8 karakter</span>}
      </label>
      {isLogin && (
        <p className="-mt-2 text-right text-sm">
          <Link href="/lupa-password" className="font-semibold text-action underline">
            Lupa password?
          </Link>
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-error-tint px-3 py-2 text-sm text-error-ink">
          {error}
        </p>
      )}

      <button type="submit" disabled={pending} className={buttonClass('primary', 'lg', 'w-full')}>
        {pending ? 'Memproses…' : isLogin ? 'Masuk' : 'Daftar'}
      </button>

      {/* Akun admin hanya dibuat oleh OWNER, jadi login admin tidak punya link daftar. */}
      {mode !== 'admin' && (
        <p className="text-center text-sm text-ink-2">
          {isLogin ? 'Belum punya akun? ' : 'Sudah punya akun? '}
          <Link
            href={`${isLogin ? '/daftar' : '/masuk'}?next=${encodeURIComponent(next)}`}
            className="font-semibold text-action underline"
          >
            {isLogin ? 'Daftar' : 'Masuk'}
          </Link>
        </p>
      )}
    </form>
  );
}
