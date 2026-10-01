'use client';

import type { ApiError, ProductDetail } from '@sportswear/shared';
import { useCallback, useState } from 'react';
import { Sheet } from '@/components/ui/sheet';
import { buttonClass } from '@/components/ui/styles';
import { AddToCart } from './add-to-cart';

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; product: ProductDetail };

/** Tombol "Pilih Ukuran" di kartu produk: membuka lembar pilih ukuran tanpa pindah halaman. */
export function QuickAdd({ slug, productName }: { slug: string; productName: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<LoadState>({ status: 'idle' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(slug)}`, { cache: 'no-store' });
      const body: unknown = await res.json();
      if (!res.ok) {
        const message = (body as ApiError).error?.message ?? 'Produk gagal dimuat.';
        setState({ status: 'error', message });
        return;
      }
      setState({
        status: 'ready',
        product: (body as { data: { product: ProductDetail } }).data.product,
      });
    } catch {
      setState({ status: 'error', message: 'Koneksi terputus. Coba lagi.' });
    }
  }, [slug]);

  function show() {
    setOpen(true);
    // Muat ulang setiap dibuka agar stok yang tampil selalu terbaru.
    void load();
  }

  return (
    <>
      <button
        type="button"
        onClick={show}
        className={buttonClass('primary', 'sm', 'w-full')}
        aria-haspopup="dialog"
      >
        Pilih Ukuran
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={productName} side="bottom">
        {state.status === 'loading' || state.status === 'idle' ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <p className="text-sm text-ink-2">Memuat ukuran dan stok...</p>
            <div className="flex gap-2">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className="size-11 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          </div>
        ) : state.status === 'error' ? (
          <div className="flex flex-col items-start gap-3">
            <p role="alert" className="text-sm font-semibold text-danger">
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
        ) : (
          <AddToCart
            variants={state.product.variants}
            sizeChartUrl={state.product.sizeChartUrl}
            onAdded={() => setOpen(false)}
          />
        )}
      </Sheet>
    </>
  );
}
