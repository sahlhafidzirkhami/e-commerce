'use client';

import Link from 'next/link';
import { buttonClass } from '@/components/ui/styles';
import { CartItems } from './cart-items';
import { useCart } from './cart-provider';
import { CartSummary } from './cart-summary';

export function CartPageView() {
  const { cart, status, reload } = useCart();

  return (
    <main className="mx-auto max-w-7xl px-4 pt-6 pb-40 md:px-6 md:pb-20 lg:px-8">
      <h1 className="font-display text-headline-sm leading-tight font-bold lg:text-headline">
        Keranjang
      </h1>

      {status === 'error' ? (
        <div className="mt-6 flex flex-col items-start gap-3">
          <p role="alert" className="font-semibold text-danger">
            Keranjang gagal dimuat.
          </p>
          <button
            type="button"
            onClick={() => void reload()}
            className={buttonClass('secondary', 'md')}
          >
            Coba Lagi
          </button>
        </div>
      ) : !cart ? (
        <p className="mt-6 text-ink-2" role="status">
          Memuat keranjang...
        </p>
      ) : cart.items.length === 0 ? (
        <div className="mt-6 flex flex-col items-start gap-4 rounded-2xl border border-line bg-surface p-6">
          <p className="font-semibold">Keranjang masih kosong.</p>
          <Link href="/produk" className={buttonClass('primary', 'md')}>
            Lihat Produk
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <section
            aria-label="Barang di keranjang"
            className="rounded-2xl border border-line bg-surface px-4"
          >
            <CartItems items={cart.items} />
          </section>
          {/* Mobile: ringkasan menempel di bawah layar agar total dan tombol selalu terlihat. */}
          <aside
            aria-label="Ringkasan belanja"
            className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:static lg:self-start lg:rounded-2xl lg:border lg:p-6"
          >
            <CartSummary cart={cart} />
          </aside>
        </div>
      )}
    </main>
  );
}
