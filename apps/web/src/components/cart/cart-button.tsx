'use client';

import { useCart } from './cart-provider';

export function CartButton() {
  const { cart, openDrawer } = useCart();
  const count = cart?.itemCount ?? 0;

  return (
    <button
      type="button"
      onClick={openDrawer}
      aria-haspopup="dialog"
      aria-label={count > 0 ? `Keranjang, ${count} barang` : 'Keranjang, kosong'}
      className="relative inline-flex size-11 items-center justify-center rounded-full text-ink hover:bg-muted"
    >
      <svg viewBox="0 0 24 24" aria-hidden className="size-6" fill="none">
        <path
          d="M6 7h12l-1 12H7L6 7Zm3 0a3 3 0 1 1 6 0"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
      {count > 0 && (
        <span
          aria-hidden
          className="absolute top-0.5 right-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-action px-1 text-xs leading-5 font-bold text-white"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}
