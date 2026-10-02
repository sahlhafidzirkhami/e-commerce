'use client';

import { passwordSchema } from '@sportswear/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Field, errorProps } from '@/components/checkout/field';
import { buttonClass, inputClass } from '@/components/ui/styles';
import { accountApi } from '@/lib/account-client';
import { ApiClientError, errorMessage } from '@/lib/api-client';

/**
 * Tawaran buat akun untuk pembeli tamu setelah bayar (F-08). Nama, email, dan HP diambil
 * dari pesanan; pembeli cukup membuat password.
 */
export function CreateAccountOffer({
  orderNumber,
  token,
  email,
  onCreated,
}: {
  orderNumber: string;
  token: string;
  email: string;
  onCreated: () => void;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState(false);
  const [pending, setPending] = useState(false);

  // Yang sudah login (akun lain) tidak ditawari.
  useEffect(() => {
    let cancelled = false;
    accountApi
      .me()
      .then(() => undefined)
      .catch(() => !cancelled && setVisible(true));
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Password tidak valid');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await accountApi.createFromOrder(orderNumber, token, password);
      onCreated();
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'EMAIL_TAKEN') setEmailTaken(true);
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  if (!visible) return null;

  return (
    <section
      aria-labelledby="create-account-heading"
      className="mt-6 rounded-2xl border border-line bg-surface p-4 sm:p-6"
    >
      <h2 id="create-account-heading" className="font-display text-lg font-semibold">
        Simpan pesanan ini di akun
      </h2>
      <p className="mt-1 text-sm text-ink-2">
        Buat password untuk <span className="font-semibold text-ink">{email}</span>. Riwayat pesanan
        dan alamat tersimpan, checkout berikutnya lebih cepat.
      </p>
      {emailTaken ? (
        <div className="mt-4 flex flex-col items-start gap-3">
          <p role="alert" className="text-sm font-semibold text-danger">
            {error}
          </p>
          <Link href="/masuk" className={buttonClass('secondary', 'md')}>
            Masuk
          </Link>
        </div>
      ) : (
        <form
          onSubmit={(e) => void submit(e)}
          noValidate
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <Field id="new-password" label="Password (min. 8 karakter)" error={error ?? undefined}>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                {...errorProps('new-password', error ?? undefined)}
              />
            </Field>
          </div>
          <button type="submit" disabled={pending} className={buttonClass('primary', 'md')}>
            {pending ? 'Membuat akun...' : 'Buat Akun'}
          </button>
        </form>
      )}
    </section>
  );
}
