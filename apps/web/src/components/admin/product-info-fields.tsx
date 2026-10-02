'use client';

import type { AdminCategory, ProductUpdateInput } from '@sportswear/shared';
import { Field } from '@/components/checkout/field';
import { inputClass } from '@/components/ui/styles';

/** Nilai form sebagai string agar input angka boleh kosong saat diketik. */
export interface ProductInfoForm {
  name: string;
  slug: string;
  categoryId: string;
  description: string;
  seoTitle: string;
  brand: string;
  gender: string;
  sportType: string;
  motif: string;
  sleeveLength: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  isActive: boolean;
}

export function emptyProductInfo(): ProductInfoForm {
  return {
    name: '',
    slug: '',
    categoryId: '',
    description: '',
    seoTitle: '',
    brand: '3ON',
    gender: '',
    sportType: '',
    motif: '',
    sleeveLength: '',
    // Default paket toko: 20 × 10 cm (keputusan klien).
    lengthCm: '20',
    widthCm: '10',
    heightCm: '',
    isActive: false,
  };
}

export function productInfoFrom(p: ProductUpdateInput): ProductInfoForm {
  const text = (v: string | null) => v ?? '';
  const num = (v: number | null) => (v === null ? '' : String(v));
  return {
    name: p.name,
    slug: p.slug,
    categoryId: p.categoryId ?? '',
    description: p.description,
    seoTitle: text(p.seoTitle),
    brand: text(p.brand),
    gender: text(p.gender),
    sportType: text(p.sportType),
    motif: text(p.motif),
    sleeveLength: text(p.sleeveLength),
    lengthCm: num(p.lengthCm),
    widthCm: num(p.widthCm),
    heightCm: num(p.heightCm),
    isActive: p.isActive,
  };
}

/** Form → data API. Validasi akhir tetap di server (zod). */
export function toProductInput(f: ProductInfoForm): ProductUpdateInput {
  const text = (v: string) => (v.trim() === '' ? null : v.trim());
  const num = (v: string) => (v.trim() === '' ? null : Number(v));
  return {
    name: f.name.trim(),
    slug: f.slug.trim(),
    categoryId: f.categoryId || null,
    description: f.description.trim(),
    seoTitle: text(f.seoTitle),
    brand: text(f.brand),
    gender: text(f.gender),
    sportType: text(f.sportType),
    motif: text(f.motif),
    sleeveLength: text(f.sleeveLength),
    lengthCm: num(f.lengthCm),
    widthCm: num(f.widthCm),
    heightCm: num(f.heightCm),
    isActive: f.isActive,
  };
}

interface Props {
  value: ProductInfoForm;
  onChange: (next: ProductInfoForm) => void;
  categories: AdminCategory[];
  /** Halaman ubah: slug bisa diedit, dengan peringatan. Halaman tambah: slug dari nama. */
  showSlug: boolean;
}

export function ProductInfoFields({ value, onChange, categories, showSlug }: Props) {
  const set = <K extends keyof ProductInfoForm>(key: K, v: ProductInfoForm[K]) =>
    onChange({ ...value, [key]: v });
  const text = (key: keyof ProductInfoForm, label: string, hint?: string) => (
    <Field id={`p-${key}`} label={label} {...(hint && { hint })}>
      <input
        id={`p-${key}`}
        value={value[key] as string}
        onChange={(e) => set(key, e.target.value)}
        className={inputClass}
      />
    </Field>
  );

  return (
    <div className="flex flex-col gap-4">
      {text('name', 'Nama produk')}
      {showSlug &&
        text(
          'slug',
          'Slug URL',
          'Mengubah slug mengganti alamat halaman produk; tautan lama akan 404.',
        )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="p-categoryId" label="Kategori">
          <select
            id="p-categoryId"
            value={value.categoryId}
            onChange={(e) => set('categoryId', e.target.value)}
            className={inputClass}
          >
            <option value="">Tanpa kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.isActive ? '' : ' (nonaktif)'}
              </option>
            ))}
          </select>
        </Field>
        {text('brand', 'Merek')}
      </div>
      <Field id="p-description" label="Deskripsi">
        <textarea
          id="p-description"
          rows={8}
          value={value.description}
          onChange={(e) => set('description', e.target.value)}
          className={`${inputClass} h-auto py-3`}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        {text('gender', 'Gender')}
        {text('sportType', 'Jenis olahraga')}
        {text('motif', 'Motif')}
        {text('sleeveLength', 'Panjang lengan')}
      </div>
      {text('seoTitle', 'Judul SEO (opsional)', 'Dipakai di judul pratinjau Open Graph.')}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-[13px] font-semibold">Ukuran paket (cm)</legend>
        <div className="grid grid-cols-3 gap-2">
          {(['lengthCm', 'widthCm', 'heightCm'] as const).map((key) => (
            <input
              key={key}
              aria-label={{ lengthCm: 'Panjang', widthCm: 'Lebar', heightCm: 'Tinggi' }[key]}
              placeholder={{ lengthCm: 'Panjang', widthCm: 'Lebar', heightCm: 'Tinggi' }[key]}
              type="number"
              inputMode="numeric"
              min={1}
              value={value[key]}
              onChange={(e) => set(key, e.target.value)}
              className={inputClass}
            />
          ))}
        </div>
      </fieldset>
      <label className="inline-flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={value.isActive}
          onChange={(e) => set('isActive', e.target.checked)}
          className="size-5 accent-action"
        />
        Tampilkan di toko (aktif)
      </label>
    </div>
  );
}
