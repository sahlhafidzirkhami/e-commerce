'use client';

import { addressInputSchema, type AccountAddress, type AddressInput } from '@sportswear/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { Field, errorProps } from '@/components/checkout/field';
import { buttonClass, inputClass } from '@/components/ui/styles';
import { errorMessage } from '@/lib/api-client';
import { checkoutApi, type DistrictOption, type RegionOption } from '@/lib/checkout-client';

type Errors = Partial<Record<string, string>>;
type Options<T> =
  { status: 'idle' | 'loading' | 'error'; data: T[] } | { status: 'ready'; data: T[] };

const selectClass = inputClass;

/** Form alamat buku alamat; wilayah dipilih bertahap provinsi → kota → kecamatan. */
export function AddressForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: AccountAddress | null;
  submitLabel: string;
  onSubmit: (input: AddressInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? '');
  const [recipientName, setRecipientName] = useState(initial?.recipientName ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [street, setStreet] = useState(initial?.street ?? '');
  const [postalCode, setPostalCode] = useState(initial?.postalCode ?? '');
  const [provinceId, setProvinceId] = useState<number | null>(initial?.provinceId ?? null);
  const [cityId, setCityId] = useState<number | null>(initial?.cityId ?? null);
  const [districtId, setDistrictId] = useState<number | null>(initial?.districtId ?? null);

  const [provinces, setProvinces] = useState<Options<RegionOption>>({
    status: 'loading',
    data: [],
  });
  const [cities, setCities] = useState<Options<RegionOption>>({ status: 'idle', data: [] });
  const [districts, setDistricts] = useState<Options<DistrictOption>>({ status: 'idle', data: [] });

  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function loadCities(id: number) {
    setCities({ status: 'loading', data: [] });
    try {
      setCities({ status: 'ready', data: await checkoutApi.cities(id) });
    } catch {
      setCities({ status: 'error', data: [] });
    }
  }

  async function loadDistricts(id: number) {
    setDistricts({ status: 'loading', data: [] });
    try {
      setDistricts({ status: 'ready', data: await checkoutApi.districts(id) });
    } catch {
      setDistricts({ status: 'error', data: [] });
    }
  }

  // Muat pilihan wilayah awal (dan untuk form ubah: kota & kecamatan alamat itu).
  useEffect(() => {
    checkoutApi
      .provinces()
      .then((data) => setProvinces({ status: 'ready', data }))
      .catch(() => setProvinces({ status: 'error', data: [] }));
    if (initial) {
      void loadCities(initial.provinceId);
      void loadDistricts(initial.cityId);
    }
  }, [initial]);

  function pickProvince(id: number | null) {
    setProvinceId(id);
    setCityId(null);
    setDistrictId(null);
    setDistricts({ status: 'idle', data: [] });
    if (id) void loadCities(id);
    else setCities({ status: 'idle', data: [] });
  }

  function pickCity(id: number | null) {
    setCityId(id);
    setDistrictId(null);
    if (id) void loadDistricts(id);
    else setDistricts({ status: 'idle', data: [] });
  }

  function pickDistrict(id: number | null) {
    setDistrictId(id);
    const district = districts.data.find((d) => d.id === id);
    if (district?.postalCode && !postalCode) setPostalCode(district.postalCode);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = addressInputSchema.safeParse({
      label,
      recipientName,
      phone,
      street,
      districtId: districtId ?? 0,
      postalCode,
    });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      if (!districtId) next.districtId = 'Pilih provinsi, kota, dan kecamatan';
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    setSubmitError(null);
    try {
      await onSubmit(parsed.data);
    } catch (err) {
      setSubmitError(errorMessage(err, 'Alamat gagal disimpan.'));
      setSaving(false);
    }
  }

  const text = (
    id: string,
    fieldLabel: string,
    value: string,
    set: (v: string) => void,
    extra: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <Field id={`addr-${id}`} label={fieldLabel} error={errors[id]}>
      <input
        id={`addr-${id}`}
        value={value}
        onChange={(e) => set(e.target.value)}
        className={inputClass}
        {...extra}
        {...errorProps(`addr-${id}`, errors[id])}
      />
    </Field>
  );

  const region = <T extends RegionOption>(
    id: string,
    fieldLabel: string,
    options: Options<T>,
    value: number | null,
    pick: (v: number | null) => void,
    placeholder: string,
  ) => (
    <Field
      id={`addr-${id}`}
      label={fieldLabel}
      error={options.status === 'error' ? 'Gagal memuat. Pilih ulang di atasnya.' : undefined}
    >
      <select
        id={`addr-${id}`}
        value={value ?? ''}
        disabled={options.status !== 'ready'}
        onChange={(e) => pick(e.target.value ? Number(e.target.value) : null)}
        className={selectClass}
      >
        <option value="">{options.status === 'loading' ? 'Memuat...' : placeholder}</option>
        {options.data.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </Field>
  );

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
      {text('label', 'Label (opsional, mis. Rumah atau Kantor)', label, setLabel, {
        maxLength: 30,
      })}
      <div className="grid gap-4 sm:grid-cols-2">
        {text('recipientName', 'Nama penerima', recipientName, setRecipientName, {
          autoComplete: 'name',
        })}
        {text('phone', 'Nomor HP penerima', phone, setPhone, {
          type: 'tel',
          inputMode: 'tel',
          autoComplete: 'tel',
        })}
      </div>
      {region('province', 'Provinsi', provinces, provinceId, pickProvince, 'Pilih provinsi')}
      {region('city', 'Kota/Kabupaten', cities, cityId, pickCity, 'Pilih kota/kabupaten')}
      <div>
        {region('district', 'Kecamatan', districts, districtId, pickDistrict, 'Pilih kecamatan')}
        {errors.districtId && (
          <p className="mt-1 text-xs font-semibold text-danger">{errors.districtId}</p>
        )}
      </div>
      <Field id="addr-street" label="Alamat lengkap" error={errors.street}>
        <textarea
          id="addr-street"
          rows={3}
          value={street}
          onChange={(e) => setStreet(e.target.value)}
          autoComplete="street-address"
          className={`${inputClass} h-auto py-3`}
          {...errorProps('addr-street', errors.street)}
        />
      </Field>
      <div className="sm:w-40">
        {text('postalCode', 'Kode pos', postalCode, setPostalCode, {
          inputMode: 'numeric',
          autoComplete: 'postal-code',
          maxLength: 5,
        })}
      </div>
      {submitError && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {submitError}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={saving} className={buttonClass('primary', 'md')}>
          {saving ? 'Menyimpan...' : submitLabel}
        </button>
        <button type="button" onClick={onCancel} className={buttonClass('ghost', 'md')}>
          Batal
        </button>
      </div>
    </form>
  );
}
