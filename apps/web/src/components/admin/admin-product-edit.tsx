'use client';

import {
  SIZE_ORDER,
  type AdminCategory,
  type AdminProductDetail,
  type AdminVariant,
} from '@sportswear/shared';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { buttonClass, inputClass } from '@/components/ui/styles';
import { adminProductApi } from '@/lib/admin-client';
import { errorMessage } from '@/lib/api-client';
import {
  ProductInfoFields,
  productInfoFrom,
  toProductInput,
  type ProductInfoForm,
} from './product-info-fields';

const MAX_IMAGES = 9;

type Load =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; product: AdminProductDetail };

export function AdminProductEdit({ id }: { id: string }) {
  const justCreated = useSearchParams().get('baru') === '1';
  const [state, setState] = useState<Load>({ status: 'loading' });
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [info, setInfo] = useState<ProductInfoForm | null>(null);
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoMessage, setInfoMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const product = await adminProductApi.get(id);
      setState({ status: 'ready', product });
      setInfo(productInfoFrom(product));
    } catch (err) {
      setState({ status: 'error', message: errorMessage(err, 'Produk gagal dimuat.') });
    }
  }, [id]);

  useEffect(() => {
    void load();
    adminProductApi
      .categories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [load]);

  /** Semua aksi mengembalikan produk terbaru dari server. */
  const apply = (product: AdminProductDetail) => setState({ status: 'ready', product });

  async function saveInfo(event: FormEvent) {
    event.preventDefault();
    if (!info) return;
    setSavingInfo(true);
    setInfoMessage(null);
    try {
      const product = await adminProductApi.update(id, toProductInput(info));
      apply(product);
      setInfo(productInfoFrom(product));
      setInfoMessage({ ok: true, text: 'Tersimpan.' });
    } catch (err) {
      setInfoMessage({ ok: false, text: errorMessage(err, 'Gagal menyimpan.') });
    } finally {
      setSavingInfo(false);
    }
  }

  if (state.status !== 'ready' || !info) {
    return state.status === 'error' ? (
      <div className="flex flex-col items-start gap-3">
        <p role="alert" className="font-semibold text-danger">
          {state.message}
        </p>
        <Link href="/admin/produk" className={buttonClass('secondary', 'md')}>
          Kembali ke Daftar Produk
        </Link>
      </div>
    ) : (
      <p role="status" className="text-ink-2">
        Memuat produk...
      </p>
    );
  }

  const { product } = state;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/produk"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-ink-2 hover:text-ink"
        >
          Kembali ke daftar produk
        </Link>
        <h1 className="font-display text-headline-sm leading-tight font-bold">{product.name}</h1>
        <p className="mt-1 font-mono text-sm text-ink-2">
          {product.sku}
          {product.isActive && (
            <>
              {' · '}
              <a
                href={`/produk/${product.slug}`}
                target="_blank"
                rel="noopener"
                className="font-sans font-semibold text-action underline underline-offset-4"
              >
                Lihat di toko
              </a>
            </>
          )}
        </p>
        {justCreated && (
          <p className="mt-3 rounded-xl bg-[#dcfce7] p-3 text-sm font-semibold text-[#166534]">
            Produk tersimpan. Unggah foto di bawah, lalu aktifkan agar tampil di toko.
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-6">
          <VariantsSection product={product} onChange={apply} />
          <ImagesSection product={product} onChange={apply} />
        </div>
        <div className="flex flex-col gap-6">
          <form
            onSubmit={(e) => void saveInfo(e)}
            noValidate
            className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-6"
          >
            <h2 className="font-display text-lg font-semibold">Info produk</h2>
            <ProductInfoFields value={info} onChange={setInfo} categories={categories} showSlug />
            {infoMessage && (
              <p
                role={infoMessage.ok ? 'status' : 'alert'}
                className={`text-sm font-semibold ${infoMessage.ok ? 'text-[#166534]' : 'text-danger'}`}
              >
                {infoMessage.text}
              </p>
            )}
            <button
              type="submit"
              disabled={savingInfo}
              className={buttonClass('primary', 'md', 'self-start')}
            >
              {savingInfo ? 'Menyimpan...' : 'Simpan Info'}
            </button>
          </form>
          <SizeChartSection product={product} onChange={apply} />
        </div>
      </div>
    </div>
  );
}

// ─── Ukuran & stok ──────────────────────────────────────────────────────────

function VariantsSection({
  product,
  onChange,
}: {
  product: AdminProductDetail;
  onChange: (p: AdminProductDetail) => void;
}) {
  const unused = SIZE_ORDER.filter((s) => !product.variants.some((v) => v.size === s));
  const [newSize, setNewSize] = useState(unused[0] ?? '');
  const [newPrice, setNewPrice] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  async function add(event: FormEvent) {
    event.preventDefault();
    const base = product.variants[0];
    setAdding(true);
    setAddError(null);
    try {
      onChange(
        await adminProductApi.addVariant(product.id, {
          size: newSize,
          price: Number(newPrice),
          stock: 0,
          weightGram: base?.weightGram ?? 200,
        }),
      );
      setNewPrice('');
    } catch (err) {
      setAddError(errorMessage(err));
    } finally {
      setAdding(false);
    }
  }

  useEffect(() => {
    if (!unused.includes(newSize)) setNewSize(unused[0] ?? '');
  }, [unused, newSize]);

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-6">
      <h2 className="font-display text-lg font-semibold">Ukuran, harga, dan stok</h2>
      <p className="text-sm text-ink-2">
        Harga baru hanya berlaku untuk pesanan berikutnya. Ukuran yang tidak dijual lagi cukup
        dinonaktifkan.
      </p>
      <ul className="flex flex-col divide-y divide-line">
        {product.variants.map((v) => (
          <VariantRow key={v.id} variant={v} onChange={onChange} />
        ))}
      </ul>
      {unused.length > 0 && (
        <form
          onSubmit={(e) => void add(e)}
          className="flex flex-wrap items-end gap-2 border-t border-line pt-3"
        >
          <label className="flex flex-col gap-1 text-[13px] font-semibold">
            Tambah ukuran
            <select
              value={newSize}
              onChange={(e) => setNewSize(e.target.value)}
              className={`${inputClass} w-28`}
            >
              {unused.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-semibold">
            Harga (Rp)
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              className={`${inputClass} w-36`}
            />
          </label>
          <button
            type="submit"
            disabled={adding || !newPrice}
            className={buttonClass('secondary', 'md')}
          >
            {adding ? 'Menambah...' : 'Tambah'}
          </button>
          {addError && (
            <p role="alert" className="w-full text-sm font-semibold text-danger">
              {addError}
            </p>
          )}
        </form>
      )}
    </section>
  );
}

function VariantRow({
  variant,
  onChange,
}: {
  variant: AdminVariant;
  onChange: (p: AdminProductDetail) => void;
}) {
  const [price, setPrice] = useState(String(variant.price));
  const [weight, setWeight] = useState(String(variant.weightGram));
  const [stock, setStock] = useState(String(variant.stock));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Data terbaru dari server (mis. stok berkurang karena pesanan) mengganti isian form.
  useEffect(() => {
    setPrice(String(variant.price));
    setWeight(String(variant.weightGram));
    setStock(String(variant.stock));
  }, [variant.price, variant.weightGram, variant.stock]);

  async function run(action: () => Promise<AdminProductDetail>, okText: string) {
    setPending(true);
    setMessage(null);
    try {
      onChange(await action());
      setMessage({ ok: true, text: okText });
    } catch (err) {
      setMessage({ ok: false, text: errorMessage(err) });
    } finally {
      setPending(false);
    }
  }

  const detailsChanged = price !== String(variant.price) || weight !== String(variant.weightGram);
  const stockChanged = stock !== String(variant.stock);

  return (
    <li className={`flex flex-col gap-2 py-3 ${variant.isActive ? '' : 'opacity-60'}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">
          {variant.size}{' '}
          <span className="font-mono text-xs font-normal text-ink-2">{variant.sku}</span>
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            void run(
              () =>
                adminProductApi.updateVariant(variant.id, {
                  price: variant.price,
                  weightGram: variant.weightGram,
                  isActive: !variant.isActive,
                }),
              variant.isActive ? 'Ukuran dinonaktifkan.' : 'Ukuran diaktifkan.',
            )
          }
          className={buttonClass('ghost', 'sm')}
        >
          {variant.isActive ? 'Nonaktifkan' : 'Aktifkan'}
        </button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[13px] font-semibold">
          Harga (Rp)
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={`${inputClass} w-32`}
          />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold">
          Berat (g)
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className={`${inputClass} w-24`}
          />
        </label>
        {detailsChanged && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              void run(
                () =>
                  adminProductApi.updateVariant(variant.id, {
                    price: Number(price),
                    weightGram: Number(weight),
                    isActive: variant.isActive,
                  }),
                'Harga dan berat tersimpan.',
              )
            }
            className={buttonClass('secondary', 'md')}
          >
            Simpan
          </button>
        )}
        <label className="flex flex-col gap-1 text-[13px] font-semibold">
          Stok (sekarang {variant.stock})
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            className={`${inputClass} w-28`}
          />
        </label>
        {stockChanged && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              void run(
                () => adminProductApi.setStock(variant.id, variant.stock, Number(stock)),
                'Stok tersimpan.',
              )
            }
            className={buttonClass('secondary', 'md')}
          >
            Simpan Stok
          </button>
        )}
      </div>
      {message && (
        <p
          role={message.ok ? 'status' : 'alert'}
          className={`text-sm font-semibold ${message.ok ? 'text-[#166534]' : 'text-danger'}`}
        >
          {message.text}
        </p>
      )}
    </li>
  );
}

// ─── Foto ───────────────────────────────────────────────────────────────────

function ImagesSection({
  product,
  onChange,
}: {
  product: AdminProductDetail;
  onChange: (p: AdminProductDetail) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const images = product.images;

  async function upload(files: FileList) {
    const room = MAX_IMAGES - images.length;
    const selected = [...files].slice(0, room);
    setError(files.length > room ? `Maksimal ${MAX_IMAGES} foto; sisanya tidak diunggah.` : null);
    // Berurutan agar urutan foto mengikuti urutan pilihan dan server tidak dibanjiri.
    for (const [index, file] of selected.entries()) {
      setProgress(`Mengunggah ${index + 1} dari ${selected.length}...`);
      try {
        onChange(await adminProductApi.uploadImage(product.id, file));
      } catch (err) {
        setError(`${file.name}: ${errorMessage(err, 'gagal diunggah')}`);
        break;
      }
    }
    setProgress(null);
    if (input.current) input.current.value = '';
  }

  async function move(index: number, delta: -1 | 1) {
    const ids = images.map((i) => i.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + delta, 0, moved!);
    try {
      onChange(await adminProductApi.reorderImages(product.id, ids));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(imageId: string) {
    try {
      onChange(await adminProductApi.deleteImage(imageId));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">
          Foto{' '}
          <span className="text-sm font-normal text-ink-2">
            ({images.length}/{MAX_IMAGES})
          </span>
        </h2>
        {images.length < MAX_IMAGES && (
          <label className={buttonClass('secondary', 'sm', 'cursor-pointer')}>
            Unggah Foto
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={progress !== null}
              onChange={(e) => e.target.files && void upload(e.target.files)}
              className="sr-only"
            />
          </label>
        )}
      </div>
      <p className="text-sm text-ink-2">
        Foto pertama jadi cover di katalog; sebaiknya persegi (1:1). Disimpan sebagai WebP.
      </p>
      {progress && (
        <p role="status" className="text-sm font-semibold">
          {progress}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
      {images.length === 0 ? (
        <p className="rounded-xl bg-muted p-4 text-sm text-ink-2">Belum ada foto.</p>
      ) : (
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((image, index) => (
            <li key={image.id} className="flex flex-col gap-1">
              <span className="relative aspect-square overflow-hidden rounded-xl bg-muted">
                <Image
                  src={image.url}
                  alt={image.alt ?? ''}
                  fill
                  sizes="200px"
                  className="object-cover"
                />
                {index === 0 && (
                  <span className="absolute top-2 left-2 rounded-sm bg-ink px-1.5 py-0.5 text-xs font-semibold text-white">
                    Cover
                  </span>
                )}
              </span>
              <span className="flex justify-between gap-1">
                <button
                  type="button"
                  aria-label={`Geser foto ${index + 1} ke kiri`}
                  disabled={index === 0}
                  onClick={() => void move(index, -1)}
                  className={buttonClass('ghost', 'sm', 'px-3')}
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => void remove(image.id)}
                  className={buttonClass('ghost', 'sm', 'px-3 text-danger hover:text-danger-hover')}
                >
                  Hapus
                </button>
                <button
                  type="button"
                  aria-label={`Geser foto ${index + 1} ke kanan`}
                  disabled={index === images.length - 1}
                  onClick={() => void move(index, 1)}
                  className={buttonClass('ghost', 'sm', 'px-3')}
                >
                  →
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function SizeChartSection({
  product,
  onChange,
}: {
  product: AdminProductDetail;
  onChange: (p: AdminProductDetail) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setPending(true);
    setError(null);
    try {
      onChange(await adminProductApi.setSizeChart(product.id, file));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-6">
      <h2 className="font-display text-lg font-semibold">Panduan ukuran</h2>
      {product.sizeChartUrl ? (
        <span className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
          <Image
            src={product.sizeChartUrl}
            alt="Panduan ukuran"
            fill
            sizes="400px"
            className="object-contain"
          />
        </span>
      ) : (
        <p className="text-sm text-ink-2">Belum ada panduan ukuran.</p>
      )}
      <label className={buttonClass('secondary', 'sm', 'cursor-pointer self-start')}>
        {pending ? 'Mengunggah...' : product.sizeChartUrl ? 'Ganti Gambar' : 'Unggah Gambar'}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={pending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = '';
          }}
          className="sr-only"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
