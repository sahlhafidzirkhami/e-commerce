'use client';

import { ADDRESS_BOOK_LIMIT, type AccountAddress } from '@sportswear/shared';
import { useEffect, useState } from 'react';
import { buttonClass } from '@/components/ui/styles';
import { accountApi } from '@/lib/account-client';
import { errorMessage } from '@/lib/api-client';
import { AddressForm } from './address-form';

type Load =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; addresses: AccountAddress[] };

/** null = tidak ada form terbuka; 'new' = tambah; id = ubah alamat itu. */
type Editing = null | 'new' | string;

/** Buku alamat maksimal 5 (F-18). Alamat utama dipakai otomatis di checkout. */
export function AddressBook() {
  const [state, setState] = useState<Load>({ status: 'loading' });
  const [editing, setEditing] = useState<Editing>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    accountApi
      .addresses()
      .then((addresses) => setState({ status: 'ready', addresses }))
      .catch((err: unknown) => setState({ status: 'error', message: errorMessage(err) }));
  }, []);

  async function run(id: string, action: () => Promise<AccountAddress[]>) {
    setBusyId(id);
    setActionError(null);
    try {
      setState({ status: 'ready', addresses: await action() });
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  if (state.status === 'loading') {
    return (
      <p role="status" className="text-ink-2">
        Memuat alamat...
      </p>
    );
  }
  if (state.status === 'error') {
    return (
      <p role="alert" className="font-semibold text-danger">
        {state.message}
      </p>
    );
  }

  const { addresses } = state;
  const full = addresses.length >= ADDRESS_BOOK_LIMIT;

  if (editing !== null) {
    const initial = editing === 'new' ? null : (addresses.find((a) => a.id === editing) ?? null);
    return (
      <section className="rounded-2xl border border-line bg-surface p-4 sm:p-6">
        <h2 className="mb-4 font-display text-lg font-semibold">
          {initial ? 'Ubah Alamat' : 'Tambah Alamat'}
        </h2>
        <AddressForm
          initial={initial}
          submitLabel="Simpan Alamat"
          onCancel={() => setEditing(null)}
          onSubmit={async (input) => {
            const next = initial
              ? await accountApi.updateAddress(initial.id, input)
              : await accountApi.createAddress(input);
            setState({ status: 'ready', addresses: next });
            setEditing(null);
          }}
        />
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-2">
          {addresses.length} dari {ADDRESS_BOOK_LIMIT} alamat
        </p>
        <button
          type="button"
          disabled={full}
          onClick={() => setEditing('new')}
          className={buttonClass('primary', 'md')}
        >
          Tambah Alamat
        </button>
      </div>
      {full && (
        <p className="text-sm text-ink-2">Buku alamat penuh. Hapus satu alamat untuk menambah.</p>
      )}
      {actionError && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {actionError}
        </p>
      )}

      {addresses.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface p-6 text-sm text-ink-2">
          Belum ada alamat. Alamat yang disimpan muncul sebagai pilihan saat checkout.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {addresses.map((a) => (
            <li
              key={a.id}
              className={`rounded-2xl border bg-surface p-4 ${
                a.isDefault ? 'border-action' : 'border-line'
              }`}
            >
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                {a.label ?? 'Alamat'}
                {a.isDefault && (
                  <span className="rounded-sm bg-action-tint px-1.5 py-0.5 text-xs text-action-hover">
                    Utama
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm leading-relaxed">
                <span className="font-semibold">{a.recipientName}</span> · {a.phone}
                <br />
                {a.street}
                <br />
                <span className="text-ink-2">
                  {a.district}, {a.city}, {a.province} {a.postalCode}
                </span>
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => setEditing(a.id)}
                  className={buttonClass('ghost', 'sm')}
                >
                  Ubah
                </button>
                {!a.isDefault && (
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => void run(a.id, () => accountApi.setDefaultAddress(a.id))}
                    className={buttonClass('ghost', 'sm')}
                  >
                    Jadikan Utama
                  </button>
                )}
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => void run(a.id, () => accountApi.deleteAddress(a.id))}
                  className={buttonClass('ghost', 'sm', 'text-danger hover:text-danger-hover')}
                >
                  {busyId === a.id ? 'Memproses...' : 'Hapus'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
