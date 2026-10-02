'use client';

import { VOUCHER_STATE_LABELS, type AdminVoucher, type VoucherState } from '@sportswear/shared';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Field } from '@/components/checkout/field';
import { Sheet } from '@/components/ui/sheet';
import { buttonClass, inputClass } from '@/components/ui/styles';
import { adminApi, type VoucherPayload } from '@/lib/admin-client';
import { errorMessage } from '@/lib/api-client';
import { formatRupiah } from '@/lib/format';
import { isoToWibInput, wibInputToIso } from '@/lib/wib';

const dateTime = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Jakarta',
});

const STATE_TONE: Record<VoucherState, string> = {
  active: 'bg-[#dcfce7] text-[#166534]',
  scheduled: 'bg-[#dbeafe] text-[#1e40af]',
  ended: 'bg-muted text-[#404040]',
  exhausted: 'bg-warning-tint text-warning-ink',
  inactive: 'bg-muted text-[#404040]',
};

interface FormState {
  code: string;
  type: 'FIXED' | 'PERCENT';
  value: string;
  maxDiscount: string;
  minPurchase: string;
  quota: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

function emptyForm(): FormState {
  const now = new Date();
  return {
    code: '',
    type: 'FIXED',
    value: '',
    maxDiscount: '',
    minPurchase: '0',
    quota: '',
    startsAt: isoToWibInput(now.toISOString()),
    endsAt: isoToWibInput(new Date(now.getTime() + 30 * 86_400_000).toISOString()),
    isActive: true,
  };
}

function formFrom(v: AdminVoucher): FormState {
  return {
    code: v.code,
    type: v.type,
    value: String(v.value),
    maxDiscount: v.maxDiscount === null ? '' : String(v.maxDiscount),
    minPurchase: String(v.minPurchase),
    quota: String(v.quota),
    startsAt: isoToWibInput(v.startsAt),
    endsAt: isoToWibInput(v.endsAt),
    isActive: v.isActive,
  };
}

function describeValue(v: AdminVoucher): string {
  if (v.type === 'FIXED') return `Potongan ${formatRupiah(v.value)}`;
  return `Potongan ${v.value}%${v.maxDiscount ? `, maks. ${formatRupiah(v.maxDiscount)}` : ''}`;
}

type Load =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; vouchers: AdminVoucher[] };

export function AdminVoucherPage() {
  const [state, setState] = useState<Load>({ status: 'loading' });
  const [editing, setEditing] = useState<AdminVoucher | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setState({ status: 'ready', vouchers: await adminApi.vouchers() });
    } catch (err) {
      setState({ status: 'error', message: errorMessage(err, 'Voucher gagal dimuat.') });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function open(target: AdminVoucher | 'new') {
    setEditing(target);
    setForm(target === 'new' ? emptyForm() : formFrom(target));
    setFormError(null);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const payload: VoucherPayload = {
      code: form.code.trim().toUpperCase(),
      type: form.type,
      value: Number(form.value),
      maxDiscount: form.type === 'PERCENT' && form.maxDiscount ? Number(form.maxDiscount) : null,
      minPurchase: Number(form.minPurchase || 0),
      quota: Number(form.quota),
      startsAt: wibInputToIso(form.startsAt),
      endsAt: wibInputToIso(form.endsAt),
      isActive: form.isActive,
    };
    setSaving(true);
    setFormError(null);
    try {
      if (editing === 'new') await adminApi.createVoucher(payload);
      else await adminApi.updateVoucher(editing.id, payload);
      setEditing(null);
      await load();
    } catch (err) {
      setFormError(errorMessage(err, 'Voucher gagal disimpan.'));
    } finally {
      setSaving(false);
    }
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-headline-sm leading-tight font-bold">Voucher</h1>
        <button type="button" onClick={() => open('new')} className={buttonClass('primary', 'md')}>
          Buat Voucher
        </button>
      </div>

      {state.status === 'loading' ? (
        <p role="status" className="text-ink-2">
          Memuat voucher...
        </p>
      ) : state.status === 'error' ? (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="font-semibold text-danger">
            {state.message}
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className={buttonClass('secondary', 'sm')}
          >
            Coba Lagi
          </button>
        </div>
      ) : state.vouchers.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-6">
          <p className="font-semibold">Belum ada voucher.</p>
          <p className="mt-1 text-sm text-ink-2">
            Voucher memotong subtotal produk, tidak memotong ongkir.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
          {state.vouchers.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => open(v)}
                className="grid w-full gap-x-4 gap-y-1 p-4 text-left hover:bg-page sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_8rem_8rem] sm:items-center"
              >
                <span className="font-mono font-semibold">{v.code}</span>
                <span className="text-sm">
                  {describeValue(v)}
                  <br />
                  <span className="text-xs text-ink-2">
                    Min. belanja {formatRupiah(v.minPurchase)} ·{' '}
                    {dateTime.format(new Date(v.startsAt))} s.d.{' '}
                    {dateTime.format(new Date(v.endsAt))} WIB
                  </span>
                </span>
                <span className="text-sm tabular-nums">
                  {v.usedCount} / {v.quota} terpakai
                </span>
                <span className="sm:justify-self-end">
                  <span
                    className={`inline-flex h-6 items-center rounded-sm px-2 text-xs font-semibold ${STATE_TONE[v.state]}`}
                  >
                    {VOUCHER_STATE_LABELS[v.state]}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Buat voucher' : `Ubah voucher ${editing?.code ?? ''}`}
        side="bottom"
      >
        <form onSubmit={(e) => void save(e)} className="flex flex-col gap-4" noValidate>
          <Field id="v-code" label="Kode" hint="Huruf, angka, - atau _. Otomatis huruf besar.">
            <input
              id="v-code"
              value={form.code}
              onChange={(e) => set('code', e.target.value)}
              autoCapitalize="characters"
              className={`${inputClass} font-mono uppercase`}
            />
          </Field>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-[13px] font-semibold">Jenis potongan</legend>
            <div className="flex flex-wrap gap-4">
              {(['FIXED', 'PERCENT'] as const).map((type) => (
                <label key={type} className="inline-flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="v-type"
                    checked={form.type === type}
                    onChange={() => set('type', type)}
                    className="size-5 accent-action"
                  />
                  {type === 'FIXED' ? 'Nominal (Rp)' : 'Persen (%)'}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="v-value" label={form.type === 'FIXED' ? 'Potongan (Rp)' : 'Potongan (%)'}>
              <input
                id="v-value"
                type="number"
                inputMode="numeric"
                min={1}
                max={form.type === 'PERCENT' ? 100 : undefined}
                value={form.value}
                onChange={(e) => set('value', e.target.value)}
                className={inputClass}
              />
            </Field>
            {form.type === 'PERCENT' && (
              <Field id="v-max" label="Maks. potongan (Rp, opsional)">
                <input
                  id="v-max"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={form.maxDiscount}
                  onChange={(e) => set('maxDiscount', e.target.value)}
                  className={inputClass}
                />
              </Field>
            )}
            <Field id="v-min" label="Minimal belanja (Rp)">
              <input
                id="v-min"
                type="number"
                inputMode="numeric"
                min={0}
                value={form.minPurchase}
                onChange={(e) => set('minPurchase', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field
              id="v-quota"
              label="Kuota"
              hint={
                editing && editing !== 'new' ? `Sudah terpakai ${editing.usedCount}.` : undefined
              }
            >
              <input
                id="v-quota"
                type="number"
                inputMode="numeric"
                min={1}
                value={form.quota}
                onChange={(e) => set('quota', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field id="v-start" label="Mulai (WIB)">
              <input
                id="v-start"
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => set('startsAt', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field id="v-end" label="Berakhir (WIB)">
              <input
                id="v-end"
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => set('endsAt', e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <label className="inline-flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => set('isActive', e.target.checked)}
              className="size-5 accent-action"
            />
            Aktif (bisa dipakai pembeli dalam masa berlaku)
          </label>

          {editing !== 'new' && (
            <p className="text-xs text-ink-2">
              Perubahan hanya berlaku untuk pesanan baru. Pesanan lama tetap memakai potongan saat
              checkout.
            </p>
          )}
          {formError && (
            <p role="alert" className="text-sm font-semibold text-danger">
              {formError}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving} className={buttonClass('primary', 'md')}>
              {saving ? 'Menyimpan...' : 'Simpan Voucher'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className={buttonClass('ghost', 'md')}
            >
              Batal
            </button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
