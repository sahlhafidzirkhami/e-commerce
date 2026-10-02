'use client';

import { profileInputSchema, type AuthUser } from '@sportswear/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useCart } from '@/components/cart/cart-provider';
import { Field, errorProps } from '@/components/checkout/field';
import { Sheet } from '@/components/ui/sheet';
import { buttonClass, inputClass } from '@/components/ui/styles';
import { accountApi } from '@/lib/account-client';
import { errorMessage } from '@/lib/api-client';

type Errors = Partial<Record<'name' | 'phone', string>>;

export function AccountProfile() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    accountApi
      .me()
      .then((me) => {
        setUser(me);
        setName(me.name);
        setPhone(me.phone ?? '');
      })
      .catch((err: unknown) => setMessage({ ok: false, text: errorMessage(err) }));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    const parsed = profileInputSchema.safeParse({ name, phone });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof Errors;
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    setMessage(null);
    try {
      setUser(await accountApi.updateProfile(parsed.data));
      setMessage({ ok: true, text: 'Profil tersimpan.' });
    } catch (err) {
      setMessage({ ok: false, text: errorMessage(err, 'Profil gagal disimpan.') });
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    return message ? (
      <p role="alert" className="font-semibold text-danger">
        {message.text}
      </p>
    ) : (
      <p role="status" className="text-ink-2">
        Memuat profil...
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={(e) => void save(e)}
        noValidate
        className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-6"
      >
        <h2 className="font-display text-lg font-semibold">Profil</h2>
        <Field id="profile-name" label="Nama" error={errors.name}>
          <input
            id="profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            className={inputClass}
            {...errorProps('profile-name', errors.name)}
          />
        </Field>
        <Field
          id="profile-phone"
          label="Nomor HP"
          error={errors.phone}
          hint="Dipakai untuk mengisi kontak saat checkout."
        >
          <input
            id="profile-phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            className={inputClass}
            {...errorProps('profile-phone', errors.phone)}
          />
        </Field>
        <Field id="profile-email" label="Email" hint="Email tidak bisa diubah.">
          <input id="profile-email" value={user.email} disabled className={inputClass} />
        </Field>
        {message && (
          <p
            role={message.ok ? 'status' : 'alert'}
            className={`text-sm font-semibold ${message.ok ? 'text-[#166534]' : 'text-danger'}`}
          >
            {message.text}
          </p>
        )}
        <button
          type="submit"
          disabled={saving}
          className={buttonClass('primary', 'md', 'self-start')}
        >
          {saving ? 'Menyimpan...' : 'Simpan Profil'}
        </button>
      </form>

      {user.role === 'CUSTOMER' && <DeleteAccount />}
    </div>
  );
}

function DeleteAccount() {
  const router = useRouter();
  const { reload: reloadCart } = useCart();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm(event: FormEvent) {
    event.preventDefault();
    if (!password) {
      setError('Password wajib diisi');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await accountApi.deleteAccount(password);
      void reloadCart();
      router.replace('/');
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, 'Akun gagal dihapus.'));
      setPending(false);
    }
  }

  function close() {
    setOpen(false);
    setPassword('');
    setError(null);
  }

  return (
    <section className="flex flex-col items-start gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-6">
      <h2 className="font-display text-lg font-semibold">Hapus akun</h2>
      <p className="text-sm text-ink-2">
        Akun, alamat tersimpan, dan keranjang dihapus permanen. Catatan pesanan tetap kami simpan
        sebagai bukti transaksi. Akun hanya bisa dihapus bila tidak ada pesanan yang sedang
        berjalan.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClass('destructive', 'md')}
      >
        Hapus Akun
      </button>

      <Sheet open={open} onClose={close} title="Hapus akun?">
        <form onSubmit={(e) => void confirm(e)} noValidate className="flex flex-col gap-4">
          <p className="text-sm">
            Tindakan ini tidak bisa dibatalkan. Masukkan password untuk melanjutkan.
          </p>
          <Field id="delete-password" label="Password" error={error ?? undefined}>
            <input
              id="delete-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              {...errorProps('delete-password', error ?? undefined)}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pending} className={buttonClass('destructive', 'md')}>
              {pending ? 'Menghapus...' : 'Hapus Permanen'}
            </button>
            <button type="button" onClick={close} className={buttonClass('ghost', 'md')}>
              Batal
            </button>
          </div>
        </form>
      </Sheet>
    </section>
  );
}
