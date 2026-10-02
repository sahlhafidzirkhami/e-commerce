'use client';

import {
  checkoutContactSchema,
  shippingAddressSchema,
  ADDRESS_BOOK_LIMIT,
  type AccountAddress,
  type AuthUser,
  type CheckoutQuote,
} from '@sportswear/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useCart } from '@/components/cart/cart-provider';
import { buttonClass, inputClass } from '@/components/ui/styles';
import { accountApi } from '@/lib/account-client';
import { ApiClientError, apiFetch, errorMessage } from '@/lib/api-client';
import {
  checkoutApi,
  type DistrictOption,
  type RegionOption,
  type ShippingRate,
} from '@/lib/checkout-client';
import { formatRupiah } from '@/lib/format';
import { Field, errorProps } from './field';

type Step = 1 | 2 | 3;
type Errors = Partial<Record<string, string>>;
type Load<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T };

const STEP_LABELS: Record<Step, string> = { 1: 'Alamat', 2: 'Pengiriman', 3: 'Pembayaran' };
const selectClass = `${inputClass} appearance-none bg-[length:16px] bg-[right_1rem_center] bg-no-repeat pr-10`;

function firstErrors(issues: { path: PropertyKey[]; message: string }[], prefix: string): Errors {
  const errors: Errors = {};
  for (const issue of issues) {
    const key = `${prefix}.${String(issue.path[0] ?? '')}`;
    errors[key] ??= issue.message;
  }
  return errors;
}

export function CheckoutView() {
  const router = useRouter();
  const { cart, status: cartStatus, reload: reloadCart } = useCart();

  const [step, setStep] = useState<Step>(1);
  const [contact, setContact] = useState({ name: '', email: '', phone: '' });
  const [recipient, setRecipient] = useState({ name: '', phone: '' });
  const [sameAsContact, setSameAsContact] = useState(true);
  const [street, setStreet] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [errors, setErrors] = useState<Errors>({});

  const [provinces, setProvinces] = useState<Load<RegionOption[]>>({ status: 'loading' });
  const [cities, setCities] = useState<Load<RegionOption[]>>({ status: 'idle' });
  const [districts, setDistricts] = useState<Load<DistrictOption[]>>({ status: 'idle' });
  const [provinceId, setProvinceId] = useState<number | null>(null);
  const [cityId, setCityId] = useState<number | null>(null);
  const [districtId, setDistrictId] = useState<number | null>(null);

  const [rates, setRates] = useState<Load<ShippingRate[]>>({ status: 'idle' });
  const [choice, setChoice] = useState<ShippingRate | null>(null);

  const [voucherInput, setVoucherInput] = useState('');
  const [voucherCode, setVoucherCode] = useState<string | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [quote, setQuote] = useState<Load<CheckoutQuote>>({ status: 'idle' });
  const quoteSeq = useRef(0);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Member: buku alamat (F-18). null = isi alamat baru di form.
  const [isMember, setIsMember] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<AccountAddress[]>([]);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saveAddress, setSaveAddress] = useState(true);
  const selectedSaved = savedAddresses.find((a) => a.id === savedId) ?? null;
  const canSaveAddress = isMember && !selectedSaved && savedAddresses.length < ADDRESS_BOOK_LIMIT;

  // Prefill kontak dan alamat utama dari akun yang sedang login.
  useEffect(() => {
    apiFetch<{ user: AuthUser }>('/auth/me')
      .then(async ({ user }) => {
        setIsMember(true);
        setContact((c) => ({
          name: c.name || user.name,
          email: c.email || user.email,
          phone: c.phone || user.phone || '',
        }));
        const addresses = await accountApi.addresses();
        setSavedAddresses(addresses);
        // Diurutkan server: alamat utama paling atas.
        setSavedId((current) => current ?? addresses[0]?.id ?? null);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    checkoutApi
      .provinces()
      .then((data) => setProvinces({ status: 'ready', data }))
      .catch((err: unknown) => setProvinces({ status: 'error', message: errorMessage(err) }));
  }, []);

  async function pickProvince(id: number | null) {
    setProvinceId(id);
    setCityId(null);
    setDistrictId(null);
    setDistricts({ status: 'idle' });
    if (!id) return setCities({ status: 'idle' });
    setCities({ status: 'loading' });
    try {
      setCities({ status: 'ready', data: await checkoutApi.cities(id) });
    } catch (err) {
      setCities({ status: 'error', message: errorMessage(err) });
    }
  }

  async function pickCity(id: number | null) {
    setCityId(id);
    setDistrictId(null);
    if (!id) return setDistricts({ status: 'idle' });
    setDistricts({ status: 'loading' });
    try {
      setDistricts({ status: 'ready', data: await checkoutApi.districts(id) });
    } catch (err) {
      setDistricts({ status: 'error', message: errorMessage(err) });
    }
  }

  function pickDistrict(id: number | null) {
    setDistrictId(id);
    const district =
      districts.status === 'ready' ? districts.data.find((d) => d.id === id) : undefined;
    if (district?.postalCode && !postalCode) setPostalCode(district.postalCode);
  }

  const address = useMemo(
    () =>
      selectedSaved
        ? {
            recipientName: selectedSaved.recipientName,
            phone: selectedSaved.phone,
            street: selectedSaved.street,
            districtId: selectedSaved.districtId,
            postalCode: selectedSaved.postalCode,
          }
        : {
            recipientName: sameAsContact ? contact.name : recipient.name,
            phone: sameAsContact ? contact.phone : recipient.phone,
            street,
            districtId: districtId ?? 0,
            postalCode,
          },
    [selectedSaved, sameAsContact, contact, recipient, street, districtId, postalCode],
  );
  /** Kecamatan tujuan dari alamat tersimpan atau dari form. */
  const destinationId = address.districtId || null;

  async function loadRates(id: number) {
    setRates({ status: 'loading' });
    setChoice(null);
    try {
      const { rates: data } = await checkoutApi.rates(id);
      setRates(
        data.length === 0
          ? { status: 'error', message: 'Tidak ada kurir yang melayani alamat ini.' }
          : { status: 'ready', data },
      );
    } catch (err) {
      setRates({ status: 'error', message: errorMessage(err) });
    }
  }

  async function loadQuote(code: string | null) {
    if (!destinationId || !choice) return;
    // Hanya respons permintaan terakhir yang dipakai: respons lama yang datang belakangan
    // (mis. hitung ulang tanpa voucher) tidak boleh menimpa voucher yang baru dipasang.
    const seq = ++quoteSeq.current;
    setQuote({ status: 'loading' });
    if (code) setVoucherError(null);
    let data: CheckoutQuote;
    try {
      data = await checkoutApi.quote({
        districtId: destinationId,
        shipping: { courier: choice.courier, service: choice.service },
        ...(code && { voucherCode: code }),
      });
    } catch (err) {
      if (seq !== quoteSeq.current) return;
      if (code && err instanceof ApiClientError && err.code === 'VOUCHER_INVALID') {
        // Pesan error tetap tampil; total dihitung ulang tanpa voucher.
        setVoucherError(err.message);
        setVoucherCode(null);
        void loadQuote(null);
        return;
      }
      setQuote({ status: 'error', message: errorMessage(err) });
      return;
    }
    if (seq !== quoteSeq.current) return;
    setQuote({ status: 'ready', data });
    setVoucherCode(code);
  }

  function submitAddress(event: FormEvent) {
    event.preventDefault();
    const contactResult = checkoutContactSchema.safeParse(contact);
    const addressResult = shippingAddressSchema.safeParse(address);
    const next: Errors = {
      ...(contactResult.success ? {} : firstErrors(contactResult.error.issues, 'contact')),
      ...(addressResult.success ? {} : firstErrors(addressResult.error.issues, 'address')),
    };
    if (!destinationId) next['address.districtId'] = 'Pilih provinsi, kota, dan kecamatan';
    setErrors(next);
    if (Object.keys(next).length > 0) {
      document.getElementById(Object.keys(next)[0]!)?.focus();
      return;
    }
    setStep(2);
    void loadRates(destinationId!);
  }

  function submitShipping(event: FormEvent) {
    event.preventDefault();
    if (!choice) return;
    setStep(3);
    void loadQuote(voucherCode);
  }

  async function pay() {
    if (!destinationId || !choice) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const order = await checkoutApi.createOrder({
        contact,
        address,
        shipping: { courier: choice.courier, service: choice.service },
        ...(voucherCode && { voucherCode }),
        ...(notes.trim() && { notes: notes.trim() }),
        ...(canSaveAddress && saveAddress && { saveAddress: true }),
      });
      void reloadCart();
      router.push(
        `/pesanan/${encodeURIComponent(order.orderNumber)}?token=${encodeURIComponent(order.accessToken)}&bayar=1`,
      );
    } catch (err) {
      setSubmitError(errorMessage(err, 'Pesanan gagal dibuat. Coba lagi.'));
      setSubmitting(false);
    }
  }

  // ─── State keranjang ──────────────────────────────────────────────────────
  if (cartStatus === 'error') {
    return (
      <Shell>
        <p role="alert" className="font-semibold text-danger">
          Keranjang gagal dimuat.
        </p>
        <button
          type="button"
          onClick={() => void reloadCart()}
          className={buttonClass('secondary', 'md')}
        >
          Coba Lagi
        </button>
      </Shell>
    );
  }
  if (!cart) {
    return (
      <Shell>
        <p role="status" className="text-ink-2">
          Memuat keranjang...
        </p>
      </Shell>
    );
  }
  if (cart.items.length === 0 && !submitting) {
    return (
      <Shell>
        <p className="font-semibold">Keranjang masih kosong.</p>
        <Link href="/produk" className={buttonClass('primary', 'md')}>
          Lihat Produk
        </Link>
      </Shell>
    );
  }
  if (cart.hasIssues) {
    return (
      <Shell>
        <p className="font-semibold">Ada barang di keranjang yang stoknya berubah.</p>
        <Link href="/keranjang" className={buttonClass('primary', 'md')}>
          Periksa Keranjang
        </Link>
      </Shell>
    );
  }

  const shippingCost = quote.status === 'ready' ? quote.data.shippingCost : (choice?.cost ?? null);
  const total = quote.status === 'ready' ? quote.data.total : cart.subtotal + (shippingCost ?? 0);

  return (
    <main className="mx-auto max-w-7xl px-4 pt-6 pb-40 md:px-6 lg:px-8 lg:pb-20">
      <h1 className="font-display text-headline-sm leading-tight font-bold lg:text-headline">
        Checkout
      </h1>
      <p className="mt-1 text-sm text-ink-2" aria-live="polite">
        Langkah {step} dari 3: {STEP_LABELS[step]}
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          {/* Langkah 1: kontak dan alamat */}
          <section
            aria-labelledby="step-1"
            className="rounded-2xl border border-line bg-surface p-4 sm:p-6"
          >
            <StepHeading
              id="step-1"
              number={1}
              active={step === 1}
              onEdit={step > 1 ? () => setStep(1) : undefined}
            >
              Kontak dan alamat
            </StepHeading>
            {step === 1 ? (
              <form
                id="form-step-1"
                onSubmit={submitAddress}
                noValidate
                className="mt-4 flex flex-col gap-4"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="contact.name" label="Nama lengkap" error={errors['contact.name']}>
                    <input
                      id="contact.name"
                      autoComplete="name"
                      value={contact.name}
                      onChange={(e) => setContact({ ...contact, name: e.target.value })}
                      className={inputClass}
                      {...errorProps('contact.name', errors['contact.name'])}
                    />
                  </Field>
                  <Field id="contact.phone" label="Nomor HP" error={errors['contact.phone']}>
                    <input
                      id="contact.phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="Contoh: 081234567890"
                      value={contact.phone}
                      onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                      className={inputClass}
                      {...errorProps('contact.phone', errors['contact.phone'])}
                    />
                  </Field>
                </div>
                <Field
                  id="contact.email"
                  label="Email"
                  error={errors['contact.email']}
                  hint="Konfirmasi pesanan dan nomor resi dikirim ke email ini."
                >
                  <input
                    id="contact.email"
                    type="email"
                    autoComplete="email"
                    placeholder="email@example.com"
                    value={contact.email}
                    onChange={(e) => setContact({ ...contact, email: e.target.value })}
                    className={inputClass}
                    {...errorProps('contact.email', errors['contact.email'])}
                  />
                </Field>

                {savedAddresses.length > 0 && (
                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-1 text-[13px] font-semibold">Alamat pengiriman</legend>
                    {savedAddresses.map((a) => (
                      <label
                        key={a.id}
                        className={`flex cursor-pointer gap-3 rounded-xl border-[1.5px] p-3 text-sm ${
                          savedId === a.id ? 'border-action bg-action-tint' : 'border-line-input'
                        }`}
                      >
                        <input
                          type="radio"
                          name="saved-address"
                          checked={savedId === a.id}
                          onChange={() => setSavedId(a.id)}
                          className="mt-0.5 size-5 shrink-0 accent-action"
                        />
                        <span>
                          <span className="font-semibold">
                            {a.label ?? a.recipientName}
                            {a.isDefault && ' (utama)'}
                          </span>
                          <br />
                          {a.recipientName} · {a.phone}
                          <br />
                          <span className="text-ink-2">
                            {a.street}, {a.district}, {a.city} {a.postalCode}
                          </span>
                        </span>
                      </label>
                    ))}
                    <label
                      className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border-[1.5px] px-3 text-sm font-semibold ${
                        savedId === null ? 'border-action bg-action-tint' : 'border-line-input'
                      }`}
                    >
                      <input
                        type="radio"
                        name="saved-address"
                        checked={savedId === null}
                        onChange={() => setSavedId(null)}
                        className="size-5 shrink-0 accent-action"
                      />
                      Kirim ke alamat lain
                    </label>
                  </fieldset>
                )}

                {!selectedSaved && (
                  <>
                    <label className="inline-flex min-h-11 items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={sameAsContact}
                        onChange={(e) => setSameAsContact(e.target.checked)}
                        className="size-5 accent-action"
                      />
                      Penerima sama dengan kontak di atas
                    </label>
                    {!sameAsContact && (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field
                          id="address.recipientName"
                          label="Nama penerima"
                          error={errors['address.recipientName']}
                        >
                          <input
                            id="address.recipientName"
                            value={recipient.name}
                            onChange={(e) => setRecipient({ ...recipient, name: e.target.value })}
                            className={inputClass}
                            {...errorProps(
                              'address.recipientName',
                              errors['address.recipientName'],
                            )}
                          />
                        </Field>
                        <Field
                          id="address.phone"
                          label="Nomor HP penerima"
                          error={errors['address.phone']}
                        >
                          <input
                            id="address.phone"
                            type="tel"
                            inputMode="tel"
                            placeholder="Contoh: 081234567890"
                            value={recipient.phone}
                            onChange={(e) => setRecipient({ ...recipient, phone: e.target.value })}
                            className={inputClass}
                            {...errorProps('address.phone', errors['address.phone'])}
                          />
                        </Field>
                      </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field
                        id="address.province"
                        label="Provinsi"
                        error={provinces.status === 'error' ? provinces.message : undefined}
                      >
                        <select
                          id="address.province"
                          value={provinceId ?? ''}
                          disabled={provinces.status !== 'ready'}
                          onChange={(e) =>
                            void pickProvince(e.target.value ? Number(e.target.value) : null)
                          }
                          className={selectClass}
                        >
                          <option value="">
                            {provinces.status === 'loading' ? 'Memuat...' : 'Pilih provinsi'}
                          </option>
                          {provinces.status === 'ready' &&
                            provinces.data.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                        </select>
                      </Field>
                      <Field
                        id="address.city"
                        label="Kota/kabupaten"
                        error={cities.status === 'error' ? cities.message : undefined}
                      >
                        <select
                          id="address.city"
                          value={cityId ?? ''}
                          disabled={cities.status !== 'ready'}
                          onChange={(e) =>
                            void pickCity(e.target.value ? Number(e.target.value) : null)
                          }
                          className={selectClass}
                        >
                          <option value="">
                            {cities.status === 'loading' ? 'Memuat...' : 'Pilih kota'}
                          </option>
                          {cities.status === 'ready' &&
                            cities.data.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                        </select>
                      </Field>
                      <Field
                        id="address.districtId"
                        label="Kecamatan"
                        error={
                          districts.status === 'error'
                            ? districts.message
                            : errors['address.districtId']
                        }
                      >
                        <select
                          id="address.districtId"
                          value={districtId ?? ''}
                          disabled={districts.status !== 'ready'}
                          onChange={(e) =>
                            pickDistrict(e.target.value ? Number(e.target.value) : null)
                          }
                          className={selectClass}
                          {...errorProps('address.districtId', errors['address.districtId'])}
                        >
                          <option value="">
                            {districts.status === 'loading' ? 'Memuat...' : 'Pilih kecamatan'}
                          </option>
                          {districts.status === 'ready' &&
                            districts.data.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name}
                              </option>
                            ))}
                        </select>
                      </Field>
                    </div>

                    <Field
                      id="address.street"
                      label="Alamat lengkap"
                      error={errors['address.street']}
                    >
                      <textarea
                        id="address.street"
                        rows={3}
                        autoComplete="street-address"
                        placeholder="Nama jalan, nomor rumah, RT/RW, patokan"
                        value={street}
                        onChange={(e) => setStreet(e.target.value)}
                        className={`${inputClass} h-auto py-3`}
                        {...errorProps('address.street', errors['address.street'])}
                      />
                    </Field>
                    <div className="sm:max-w-48">
                      <Field
                        id="address.postalCode"
                        label="Kode pos"
                        error={errors['address.postalCode']}
                      >
                        <input
                          id="address.postalCode"
                          inputMode="numeric"
                          autoComplete="postal-code"
                          maxLength={5}
                          placeholder="Contoh: 40266"
                          value={postalCode}
                          onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, ''))}
                          className={inputClass}
                          {...errorProps('address.postalCode', errors['address.postalCode'])}
                        />
                      </Field>
                    </div>
                    {canSaveAddress && (
                      <label className="inline-flex min-h-11 items-center gap-3 text-sm">
                        <input
                          type="checkbox"
                          checked={saveAddress}
                          onChange={(e) => setSaveAddress(e.target.checked)}
                          className="size-5 accent-action"
                        />
                        Simpan ke buku alamat
                      </label>
                    )}
                  </>
                )}
                <button
                  type="submit"
                  className={buttonClass('primary', 'lg', 'hidden lg:inline-flex lg:self-start')}
                >
                  Lanjut ke Pengiriman
                </button>
              </form>
            ) : (
              <p className="mt-2 text-sm text-ink-2">
                {address.recipientName} · {address.phone}
                <br />
                {address.street}, {address.postalCode}
              </p>
            )}
          </section>

          {/* Langkah 2: kurir */}
          <section
            aria-labelledby="step-2"
            className="rounded-2xl border border-line bg-surface p-4 sm:p-6"
          >
            <StepHeading
              id="step-2"
              number={2}
              active={step === 2}
              onEdit={step > 2 ? () => setStep(2) : undefined}
            >
              Pengiriman
            </StepHeading>
            {step === 2 && (
              <form id="form-step-2" onSubmit={submitShipping} className="mt-4 flex flex-col gap-3">
                {rates.status === 'loading' || rates.status === 'idle' ? (
                  <div role="status" className="flex flex-col gap-3">
                    <p className="text-sm text-ink-2">
                      Menghitung ongkir dari beberapa kurir. Biasanya butuh sampai 15 detik.
                    </p>
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
                    ))}
                  </div>
                ) : rates.status === 'error' ? (
                  <div className="flex flex-col items-start gap-3">
                    <p role="alert" className="text-sm font-semibold text-danger">
                      {rates.message}
                    </p>
                    <button
                      type="button"
                      onClick={() => destinationId && void loadRates(destinationId)}
                      className={buttonClass('secondary', 'sm')}
                    >
                      Coba Lagi
                    </button>
                  </div>
                ) : (
                  <fieldset className="flex flex-col gap-2">
                    <legend className="sr-only">Pilih kurir dan layanan</legend>
                    {rates.data.map((rate) => {
                      const key = `${rate.courier}:${rate.service}`;
                      const selected =
                        choice?.courier === rate.courier && choice.service === rate.service;
                      return (
                        <label
                          key={key}
                          className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border-[1.5px] p-4 ${
                            selected
                              ? 'border-action bg-action-tint'
                              : 'border-line-input bg-surface hover:bg-page'
                          }`}
                        >
                          <input
                            type="radio"
                            name="shipping"
                            value={key}
                            checked={selected}
                            onChange={() => setChoice(rate)}
                            className="size-5 shrink-0 accent-action"
                          />
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="font-semibold">
                              {rate.courier.toUpperCase()} {rate.service}
                            </span>
                            <span className="text-sm text-ink-2">
                              {rate.description}
                              {rate.etd && ` · estimasi ${rate.etd.replace(/day/i, 'hari')}`}
                            </span>
                          </span>
                          <span className="shrink-0 font-bold">{formatRupiah(rate.cost)}</span>
                        </label>
                      );
                    })}
                  </fieldset>
                )}
                <button
                  type="submit"
                  disabled={!choice}
                  className={buttonClass('primary', 'lg', 'hidden lg:inline-flex lg:self-start')}
                >
                  Lanjut ke Pembayaran
                </button>
              </form>
            )}
            {step > 2 && choice && (
              <p className="mt-2 text-sm text-ink-2">
                {choice.courier.toUpperCase()} {choice.service} · {formatRupiah(choice.cost)}
              </p>
            )}
          </section>

          {/* Langkah 3: voucher dan bayar */}
          <section
            aria-labelledby="step-3"
            className="rounded-2xl border border-line bg-surface p-4 sm:p-6"
          >
            <StepHeading id="step-3" number={3} active={step === 3}>
              Pembayaran
            </StepHeading>
            {step === 3 && (
              <div className="mt-4 flex flex-col gap-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const code = voucherInput.trim().toUpperCase();
                    if (code) void loadQuote(code);
                  }}
                  className="flex flex-col gap-1"
                >
                  <label htmlFor="voucher" className="text-[13px] font-semibold">
                    Kode voucher (opsional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="voucher"
                      value={voucherInput}
                      onChange={(e) => setVoucherInput(e.target.value)}
                      autoCapitalize="characters"
                      className={`${inputClass} font-mono uppercase`}
                      {...errorProps('voucher', voucherError ?? undefined)}
                    />
                    <button type="submit" className={buttonClass('secondary', 'md', 'shrink-0')}>
                      Pakai
                    </button>
                  </div>
                  {voucherError ? (
                    <p
                      id="voucher-error"
                      role="alert"
                      className="text-xs font-semibold text-danger"
                    >
                      {voucherError}
                    </p>
                  ) : voucherCode ? (
                    <p className="text-xs text-ink-2">
                      Voucher <span className="font-mono">{voucherCode}</span> dipakai.{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setVoucherInput('');
                          setVoucherError(null);
                          void loadQuote(null);
                        }}
                        className="inline-flex min-h-11 items-center font-semibold text-action underline"
                      >
                        Lepas voucher
                      </button>
                    </p>
                  ) : null}
                </form>
                <Field id="notes" label="Catatan untuk penjual (opsional)">
                  <input
                    id="notes"
                    maxLength={300}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <p className="text-sm text-ink-2">
                  Pembayaran lewat DOKU: transfer virtual account, QRIS, atau e-wallet. Selesaikan
                  dalam 3 jam setelah pesanan dibuat.
                </p>
                {submitError && (
                  <p role="alert" className="text-sm font-semibold text-danger">
                    {submitError}
                  </p>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Ringkasan; di mobile menempel di bawah layar bersama tombol langkah aktif. */}
        <aside
          aria-label="Ringkasan belanja"
          className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] lg:static lg:self-start lg:rounded-2xl lg:border lg:p-6"
        >
          <dl className="hidden flex-col gap-2 text-sm lg:flex">
            <Row
              label={`Subtotal (${cart.itemCount} barang)`}
              value={formatRupiah(quote.status === 'ready' ? quote.data.subtotal : cart.subtotal)}
            />
            <Row
              label="Ongkir"
              value={shippingCost === null ? 'Pilih kurir' : formatRupiah(shippingCost)}
            />
            {quote.status === 'ready' && quote.data.discount > 0 && (
              <Row label="Potongan voucher" value={`-${formatRupiah(quote.data.discount)}`} />
            )}
          </dl>
          <div className="flex items-center justify-between gap-4 lg:mt-4 lg:border-t lg:border-line lg:pt-4">
            <span className="font-semibold">Total</span>
            <span className="text-lg font-bold" aria-live="polite">
              {quote.status === 'loading' ? 'Menghitung...' : formatRupiah(total)}
            </span>
          </div>
          {quote.status === 'error' && (
            <p role="alert" className="mt-2 text-sm font-semibold text-danger">
              {quote.message}
            </p>
          )}
          <div className="mt-3">
            {step === 1 && (
              <button
                type="submit"
                form="form-step-1"
                className={buttonClass('primary', 'lg', 'w-full lg:hidden')}
              >
                Lanjut ke Pengiriman
              </button>
            )}
            {step === 2 && (
              <button
                type="submit"
                form="form-step-2"
                disabled={!choice}
                className={buttonClass('primary', 'lg', 'w-full lg:hidden')}
              >
                Lanjut ke Pembayaran
              </button>
            )}
            {step === 3 && (
              <button
                type="button"
                onClick={() => void pay()}
                disabled={submitting || quote.status !== 'ready'}
                className={buttonClass('primary', 'lg', 'w-full')}
              >
                {submitting ? 'Membuat pesanan...' : 'Bayar Sekarang'}
              </button>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex max-w-7xl flex-col items-start gap-4 px-4 pt-6 pb-14 md:px-6 lg:px-8">
      <h1 className="font-display text-headline-sm leading-tight font-bold lg:text-headline">
        Checkout
      </h1>
      {children}
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-2">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

function StepHeading({
  id,
  number,
  active,
  onEdit,
  children,
}: {
  id: string;
  number: number;
  active: boolean;
  onEdit?: (() => void) | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 id={id} className={`font-display text-lg font-semibold ${active ? '' : 'text-ink-2'}`}>
        {number}. {children}
      </h2>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-action underline underline-offset-4 hover:text-action-hover"
        >
          Ubah
        </button>
      )}
    </div>
  );
}
