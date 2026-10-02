'use client';

import type { CartItemView } from '@sportswear/shared';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { QuantityStepper } from '@/components/product/quantity-stepper';
import { CartRequestError, cartApi } from '@/lib/cart-client';
import { formatRupiah } from '@/lib/format';
import { useCart } from './cart-provider';

function issueMessage(item: CartItemView): string | null {
  switch (item.issue) {
    case 'UNAVAILABLE':
      return 'Produk ini sudah tidak dijual. Hapus dari keranjang untuk lanjut.';
    case 'OUT_OF_STOCK':
      return `Stok ukuran ${item.size} habis. Hapus dari keranjang untuk lanjut.`;
    case 'INSUFFICIENT_STOCK':
      return `Stok ukuran ${item.size} tinggal ${item.stock}. Kurangi jumlahnya untuk lanjut.`;
    default:
      return null;
  }
}

function CartLine({ item, onNavigate }: { item: CartItemView; onNavigate?: () => void }) {
  const { setCart } = useCart();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => ReturnType<typeof cartApi.get>) {
    setPending(true);
    setError(null);
    try {
      setCart(await action());
    } catch (err) {
      setError(err instanceof CartRequestError ? err.message : 'Gagal memperbarui. Coba lagi.');
    } finally {
      setPending(false);
    }
  }

  const issue = issueMessage(item);
  const href = `/produk/${item.productSlug}`;

  return (
    <li className="flex gap-3 py-4" aria-busy={pending}>
      <Link
        href={href}
        onClick={onNavigate}
        className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-muted"
        tabIndex={-1}
        aria-hidden
      >
        {item.image && (
          <Image src={item.image.url} alt="" fill sizes="80px" className="object-cover" />
        )}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link
          href={href}
          onClick={onNavigate}
          className="line-clamp-2 text-sm leading-snug font-semibold hover:underline"
        >
          {item.productName}
        </Link>
        <p className="text-sm text-ink-2">Ukuran {item.size}</p>
        <p className="font-bold">{formatRupiah(item.price)}</p>
        {issue && (
          <p className="rounded-sm bg-warning-tint px-2 py-1 text-xs font-semibold text-warning-ink">
            {issue}
          </p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
          {item.issue !== 'UNAVAILABLE' && item.issue !== 'OUT_OF_STOCK' && (
            <QuantityStepper
              label={`Jumlah ${item.productName} ukuran ${item.size}`}
              value={item.quantity}
              max={Math.max(item.stock, 1)}
              disabled={pending}
              onChange={(quantity) => run(() => cartApi.update(item.variantId, quantity))}
            />
          )}
          {item.issue === 'INSUFFICIENT_STOCK' && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => cartApi.update(item.variantId, item.stock))}
              className="inline-flex min-h-11 items-center text-sm font-semibold text-action underline underline-offset-4 hover:text-action-hover"
            >
              Ubah jadi {item.stock}
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => cartApi.remove(item.variantId))}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-ink-2 underline underline-offset-4 hover:text-ink"
          >
            Hapus
          </button>
        </div>
        {error && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {error}
          </p>
        )}
      </div>
    </li>
  );
}

export function CartItems({
  items,
  onNavigate,
}: {
  items: CartItemView[];
  onNavigate?: () => void;
}) {
  return (
    <ul className="divide-y divide-line">
      {items.map((item) => (
        <CartLine key={item.variantId} item={item} {...(onNavigate && { onNavigate })} />
      ))}
    </ul>
  );
}
