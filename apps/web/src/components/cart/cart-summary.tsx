import type { CartView } from '@sportswear/shared';
import Link from 'next/link';
import { buttonClass } from '@/components/ui/styles';
import { formatRupiah } from '@/lib/format';

/** Subtotal dan tombol lanjut, dipakai di drawer dan halaman keranjang. */
export function CartSummary({ cart, onNavigate }: { cart: CartView; onNavigate?: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <span className="font-semibold">Subtotal</span>
        <span className="text-lg font-bold">{formatRupiah(cart.subtotal)}</span>
      </div>
      <p className="text-sm text-ink-2">Ongkir dihitung saat checkout setelah alamat diisi.</p>
      {cart.hasIssues ? (
        <>
          <p className="text-sm font-semibold text-warning-ink">
            Perbaiki item yang ditandai sebelum lanjut.
          </p>
          <button type="button" disabled className={buttonClass('primary', 'lg', 'w-full')}>
            Lanjut ke Checkout
          </button>
        </>
      ) : (
        <Link
          href="/checkout"
          onClick={onNavigate}
          className={buttonClass('primary', 'lg', 'w-full')}
        >
          Lanjut ke Checkout
        </Link>
      )}
    </div>
  );
}
