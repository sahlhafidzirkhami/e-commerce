'use client';

import type { AccountOrderList } from '@sportswear/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { OrderStatusChip } from '@/components/order/order-status-chip';
import { buttonClass } from '@/components/ui/styles';
import { accountApi } from '@/lib/account-client';
import { errorMessage } from '@/lib/api-client';
import { courierName } from '@/lib/couriers';
import { formatRupiah } from '@/lib/format';

type Load =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: AccountOrderList };

const date = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeZone: 'Asia/Jakarta' });

/** Riwayat pesanan member (F-18). Detail dan tautan lacak ada di halaman pesanan. */
export function AccountOrders() {
  const [page, setPage] = useState(1);
  const [state, setState] = useState<Load>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    accountApi
      .orders(page)
      .then((data) => !cancelled && setState({ status: 'ready', data }))
      .catch(
        (err: unknown) => !cancelled && setState({ status: 'error', message: errorMessage(err) }),
      );
    return () => {
      cancelled = true;
    };
  }, [page]);

  if (state.status === 'loading') {
    return (
      <div role="status" className="flex flex-col gap-2">
        <span className="sr-only">Memuat pesanan...</span>
        {[0, 1, 2].map((i) => (
          <span key={i} aria-hidden className="h-24 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <p role="alert" className="font-semibold text-danger">
        {state.message}
      </p>
    );
  }

  const { items, total, pageSize } = state.data;
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-2xl border border-line bg-surface p-6">
        <p className="font-semibold">Belum ada pesanan.</p>
        <Link href="/produk" className={buttonClass('primary', 'md')}>
          Mulai Belanja
        </Link>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {items.map((o) => (
          <li key={o.orderNumber}>
            <Link
              href={`/pesanan/${encodeURIComponent(o.orderNumber)}`}
              className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4 hover:border-line-strong"
            >
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-sm text-ink-2">{o.orderNumber}</span>
                <OrderStatusChip status={o.status} />
              </span>
              <span className="text-sm font-semibold">
                {o.firstItemName}
                {o.itemCount > 1 && (
                  <span className="font-normal text-ink-2"> dan {o.itemCount - 1} barang lain</span>
                )}
              </span>
              <span className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="text-ink-2">
                  {date.format(new Date(o.createdAt))}
                  {o.trackingNumber && (
                    <>
                      {' · '}
                      {courierName(o.courier)} <span className="font-mono">{o.trackingNumber}</span>
                    </>
                  )}
                </span>
                <span className="font-semibold">{formatRupiah(o.total)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {totalPages > 1 && (
        <nav aria-label="Halaman pesanan" className="flex items-center justify-between gap-4">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className={buttonClass('secondary', 'md')}
          >
            Sebelumnya
          </button>
          <p className="text-sm text-ink-2">
            Halaman {page} dari {totalPages}
          </p>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className={buttonClass('secondary', 'md')}
          >
            Berikutnya
          </button>
        </nav>
      )}
    </div>
  );
}
