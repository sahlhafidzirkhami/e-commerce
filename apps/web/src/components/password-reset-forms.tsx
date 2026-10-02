'use client';

import { emailSchema, passwordSchema } from '@sportswear/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Field, errorProps } from '@/components/checkout/field';
import { buttonClass, inputClass } from '@/components/ui/styles';
import { apiFetch, errorMessage } from '@/lib/api-client';

/** Langkah 1: minta tautan reset. Pesan sukses sama untuk email terdaftar maupun tidak. */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Email tidak valid');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const data = await apiFetch<{ message: string }>('/auth/password/forgot', {
        method: 'POST',
        body: JSON.stringify({ email: parsed.data }),
      });
      setSentMessage(data.message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  if (sentMessage) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="rounded-xl bg-action-tint p-4 text-sm text-ink">
          {sentMessage} Periksa juga folder Spam. Tautan berlaku 60 menit.
        </p>
        <Link href="/masuk" className={buttonClass('secondary', 'md')}>
          Kembali ke Masuk
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
      <p className="text-sm text-ink-2">
        Masukkan email akun Anda. Kami kirim tautan untuk membuat password baru.
      </p>
      <Field id="forgot-email" label="Email" error={error ?? undefined}>
        <input
          id="forgot-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          {...errorProps('forgot-email', error ?? undefined)}
        />
      </Field>
      <button type="submit" disabled={pending} className={buttonClass('primary', 'lg', 'w-full')}>
        {pending ? 'Mengirim...' : 'Kirim Tautan'}
      </button>
      <Link href="/masuk" className="text-center text-sm font-semibold text-action underline">
        Kembali ke Masuk
      </Link>
    </form>
  );
}

/** Langkah 2: password baru dari tautan email. Berhasil = langsung masuk. */
export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = passwordSchema.safeParse(password);
    const next: { password?: string; confirm?: string } = {};
    if (!parsed.success) next.password = parsed.error.issues[0]?.message ?? 'Password tidak valid';
    if (password !== confirm) next.confirm = 'Ulangi password yang sama';
    setErrors(next);
    if (next.password || next.confirm) return;

    setPending(true);
    setSubmitError(null);
    try {
      await apiFetch('/auth/password/reset', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      router.replace('/akun');
      router.refresh();
    } catch (err) {
      setSubmitError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
      <Field
        id="reset-password"
        label="Password baru"
        error={errors.password}
        hint="Minimal 8 karakter."
      >
        <input
          id="reset-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
          {...errorProps('reset-password', errors.password)}
        />
      </Field>
      <Field id="reset-confirm" label="Ulangi password baru" error={errors.confirm}>
        <input
          id="reset-confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={inputClass}
          {...errorProps('reset-confirm', errors.confirm)}
        />
      </Field>
      {submitError && (
        <div role="alert" className="flex flex-col gap-2 text-sm">
          <p className="font-semibold text-danger">{submitError}</p>
          <Link href="/lupa-password" className="font-semibold text-action underline">
            Minta tautan baru
          </Link>
        </div>
      )}
      <button type="submit" disabled={pending} className={buttonClass('primary', 'lg', 'w-full')}>
        {pending ? 'Menyimpan...' : 'Simpan Password'}
      </button>
    </form>
  );
}
