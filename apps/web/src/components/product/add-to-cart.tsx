'use client';

import type { ProductVariantView } from '@sportswear/shared';
import { useId, useState } from 'react';
import { useCart } from '@/components/cart/cart-provider';
import { buttonClass } from '@/components/ui/styles';
import { CartRequestError, cartApi } from '@/lib/cart-client';
import { formatRupiah } from '@/lib/format';
import { QuantityStepper } from './quantity-stepper';
import { SizeSelector } from './size-selector';

interface AddToCartProps {
  variants: ProductVariantView[];
  sizeChartUrl: string | null;
  /** Dipanggil setelah berhasil ditambahkan (mis. menutup lembar pilih ukuran). */
  onAdded?: () => void;
}

function initialVariant(variants: ProductVariantView[]): string | null {
  // Satu-satunya ukuran (mis. All Size) langsung terpilih bila ada stok.
  const [only] = variants;
  return variants.length === 1 && only && only.stock > 0 ? only.id : null;
}

export function AddToCart({ variants, sizeChartUrl, onAdded }: AddToCartProps) {
  const { setCart, openDrawer } = useCart();
  const labelId = useId();
  const [selectedId, setSelectedId] = useState(() => initialVariant(variants));
  const [quantity, setQuantity] = useState(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = variants.find((v) => v.id === selectedId) ?? null;
  const allSoldOut = variants.every((v) => v.stock === 0);

  function select(variantId: string) {
    setSelectedId(variantId);
    setQuantity(1);
    setError(null);
  }

  async function add() {
    if (!selected) {
      setError('Pilih ukuran dulu.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      setCart(await cartApi.add(selected.id, quantity));
      onAdded?.();
      openDrawer();
    } catch (err) {
      setError(err instanceof CartRequestError ? err.message : 'Gagal menambahkan. Coba lagi.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <p id={labelId} className="text-sm font-semibold">
            Ukuran
          </p>
          {sizeChartUrl && (
            <a
              href={sizeChartUrl}
              target="_blank"
              rel="noopener"
              className="inline-flex min-h-11 items-center text-sm font-semibold text-action underline underline-offset-4 hover:text-action-hover"
            >
              Lihat panduan ukuran
            </a>
          )}
        </div>
        <SizeSelector
          variants={variants}
          selectedId={selectedId}
          onSelect={select}
          labelId={labelId}
        />
        <p className="text-sm text-ink-2" aria-live="polite">
          {allSoldOut
            ? 'Semua ukuran sedang habis.'
            : selected
              ? `${formatRupiah(selected.price)} · stok ukuran ${selected.size}: ${selected.stock}`
              : 'Pilih ukuran untuk melihat stok.'}
        </p>
      </div>

      {!allSoldOut && (
        <div className="flex flex-wrap items-center gap-3">
          <QuantityStepper
            label="Jumlah"
            value={quantity}
            max={selected?.stock ?? 1}
            onChange={setQuantity}
            disabled={!selected || pending}
          />
          <button
            type="button"
            onClick={add}
            disabled={pending}
            className={buttonClass(
              'primary',
              'lg',
              'flex-1 basis-full whitespace-nowrap sm:basis-48',
            )}
          >
            {pending ? 'Memproses...' : 'Tambah ke Keranjang'}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
