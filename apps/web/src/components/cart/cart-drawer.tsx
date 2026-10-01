'use client';

import Link from 'next/link';
import { Sheet } from '@/components/ui/sheet';
import { buttonClass } from '@/components/ui/styles';
import { CartItems } from './cart-items';
import { useCart } from './cart-provider';
import { CartSummary } from './cart-summary';

export function CartDrawer() {
  const { cart, status, reload, drawerOpen, closeDrawer } = useCart();
  const empty = !cart || cart.items.length === 0;

  return (
    <Sheet
      open={drawerOpen}
      onClose={closeDrawer}
      title={cart && cart.itemCount > 0 ? `Keranjang (${cart.itemCount})` : 'Keranjang'}
      footer={
        cart && !empty ? (
          <div className="flex flex-col gap-3">
            <CartSummary cart={cart} />
            <Link
              href="/keranjang"
              onClick={closeDrawer}
              className={buttonClass('ghost', 'md', 'w-full')}
            >
              Lihat halaman keranjang
            </Link>
          </div>
        ) : undefined
      }
    >
      {status === 'error' ? (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="text-sm font-semibold text-danger">
            Keranjang gagal dimuat.
          </p>
          <button
            type="button"
            onClick={() => void reload()}
            className={buttonClass('secondary', 'sm')}
          >
            Coba Lagi
          </button>
        </div>
      ) : status === 'loading' && !cart ? (
        <p className="text-sm text-ink-2" aria-busy="true">
          Memuat keranjang...
        </p>
      ) : empty ? (
        <div className="flex flex-col items-start gap-4 py-6">
          <p className="font-semibold">Keranjang masih kosong.</p>
          <Link href="/produk" onClick={closeDrawer} className={buttonClass('primary', 'md')}>
            Lihat Produk
          </Link>
        </div>
      ) : (
        <CartItems items={cart.items} onNavigate={closeDrawer} />
      )}
    </Sheet>
  );
}
