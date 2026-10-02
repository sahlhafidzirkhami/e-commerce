'use client';

import { SIZE_ORDER, type AdminCategory } from '@sportswear/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Field } from '@/components/checkout/field';
import { buttonClass, inputClass } from '@/components/ui/styles';
import { adminProductApi } from '@/lib/admin-client';
import { errorMessage } from '@/lib/api-client';
import {
  ProductInfoFields,
  emptyProductInfo,
  toProductInput,
  type ProductInfoForm,
} from './product-info-fields';

interface VariantRow {
  size: string;
  price: string;
  stock: string;
  weightGram: string;
}

/** Default berat 200 g (keputusan klien untuk data tanpa berat). */
const newRow = (size: string): VariantRow => ({ size, price: '', stock: '0', weightGram: '200' });

export function AdminProductCreate() {
  const router = useRouter();
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [sku, setSku] = useState('');
  const [info, setInfo] = useState<ProductInfoForm>(emptyProductInfo);
  const [rows, setRows] = useState<VariantRow[]>(['S', 'M', 'L', 'XL'].map(newRow));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminProductApi
      .categories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const unusedSizes = SIZE_ORDER.filter((s) => !rows.some((r) => r.size === s));

  function updateRow(index: number, patch: Partial<VariantRow>) {
    setRows((current) => current.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { slug: _slug, ...fields } = toProductInput(info);
      const product = await adminProductApi.create({
        ...fields,
        sku: sku.trim().toUpperCase(),
        variants: rows.map((r) => ({
          size: r.size,
          price: Number(r.price),
          stock: Number(r.stock),
          weightGram: Number(r.weightGram),
        })),
      });
      // Lanjut ke halaman ubah untuk mengunggah foto.
      router.push(`/admin/produk/${product.id}?baru=1`);
    } catch (err) {
      setError(errorMessage(err, 'Produk gagal disimpan.'));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="flex max-w-3xl flex-col gap-6">
      <h1 className="font-display text-headline-sm leading-tight font-bold">Tambah Produk</h1>

      <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-6">
        <Field
          id="p-sku"
          label="SKU induk"
          hint="Kode model + nomor warna, mis. TSS009-1. Tidak bisa diubah setelah disimpan."
        >
          <input
            id="p-sku"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            autoCapitalize="characters"
            className={`${inputClass} font-mono uppercase`}
          />
        </Field>
        <ProductInfoFields
          value={info}
          onChange={setInfo}
          categories={categories}
          showSlug={false}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-6">
        <h2 className="font-display text-lg font-semibold">Ukuran, harga, dan stok</h2>
        <div className="flex flex-col gap-3">
          {rows.map((row, index) => (
            <fieldset
              key={row.size}
              className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[5rem_1fr_1fr_1fr_auto]"
            >
              <legend className="sr-only">Ukuran {row.size}</legend>
              <span className="col-span-2 font-semibold sm:col-span-1 sm:self-center">
                {row.size}
              </span>
              {(
                [
                  ['price', 'Harga (Rp)'],
                  ['stock', 'Stok'],
                  ['weightGram', 'Berat (g)'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex flex-col gap-1 text-[13px] font-semibold">
                  {label}
                  <input
                    type="number"
                    inputMode="numeric"
                    min={key === 'stock' ? 0 : 1}
                    value={row[key]}
                    onChange={(e) => updateRow(index, { [key]: e.target.value })}
                    className={inputClass}
                  />
                </label>
              ))}
              <button
                type="button"
                onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                disabled={rows.length === 1}
                className={buttonClass('ghost', 'sm')}
              >
                Hapus
              </button>
            </fieldset>
          ))}
        </div>
        {unusedSizes.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-ink-2">Tambah ukuran:</span>
            {unusedSizes.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() =>
                  setRows((current) =>
                    [...current, newRow(size)].sort(
                      (a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size),
                    ),
                  )
                }
                className={buttonClass('secondary', 'sm')}
              >
                {size}
              </button>
            ))}
          </div>
        )}
      </section>

      {error && (
        <p role="alert" className="font-semibold text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={saving} className={buttonClass('primary', 'lg')}>
          {saving ? 'Menyimpan...' : 'Simpan Produk'}
        </button>
        <button type="button" onClick={() => router.back()} className={buttonClass('ghost', 'lg')}>
          Batal
        </button>
      </div>
      <p className="text-sm text-ink-2">
        Foto dan panduan ukuran diunggah setelah produk disimpan.
      </p>
    </form>
  );
}
