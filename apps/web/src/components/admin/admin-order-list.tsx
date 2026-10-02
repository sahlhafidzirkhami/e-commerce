'use client';

import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  type AdminOrderListResult,
  type OrderStatus,
} from '@sportswear/shared';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { OrderStatusChip } from '@/components/order/order-status-chip';
import { buttonClass, inputClass } from '@/components/ui/styles';
import { adminApi } from '@/lib/admin-client';
import { errorMessage } from '@/lib/api-client';
import { courierName } from '@/lib/couriers';
import { formatRupiah } from '@/lib/format';

const dateTime = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Jakarta',
});

/** Status yang butuh tindakan admin ditaruh paling depan. */
const TAB_ORDER: OrderStatus[] = [
  'paid',
  'processing',
  'shipped',
  'pending',
  'delivered',
  'completed',
  'cancelled',
  'expired',
];

type Load =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: AdminOrderListResult };

function isOrderStatus(value: string | null): value is OrderStatus {
  return value !== null && (ORDER_STATUSES as readonly string[]).includes(value);
}

export function AdminOrderList() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const statusParam = params.get('status');
  const status = isOrderStatus(statusParam) ? statusParam : undefined;
  const q = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('halaman')) || 1);

  const [state, setState] = useState<Load>({ status: 'loading' });
  const [search, setSearch] = useState(q);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    adminApi
      .orders({ status, q: q || undefined, page })
      .then((data) => !cancelled && setState({ status: 'ready', data }))
      .catch(
        (err: unknown) => !cancelled && setState({ status: 'error', message: errorMessage(err) }),
      );
    return () => {
      cancelled = true;
    };
  }, [status, q, page, reloadKey]);

  function href(next: { status?: OrderStatus | undefined; q?: string; page?: number }) {
    const qs = new URLSearchParams();
    const nextStatus = 'status' in next ? next.status : status;
    const nextQ = next.q ?? q;
    if (nextStatus) qs.set('status', nextStatus);
    if (nextQ) qs.set('q', nextQ);
    if (next.page && next.page > 1) qs.set('halaman', String(next.page));
    const query = qs.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    router.push(href({ q: search.trim() }));
  }

  const counts = state.status === 'ready' ? state.data.countsByStatus : null;
  const allCount = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : null;
  const totalPages =
    state.status === 'ready' ? Math.max(1, Math.ceil(state.data.total / state.data.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-headline-sm leading-tight font-bold">Pesanan</h1>
        <form onSubmit={submitSearch} role="search" className="flex w-full gap-2 sm:w-auto">
          <label htmlFor="order-search" className="sr-only">
            Cari pesanan
          </label>
          <input
            id="order-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nomor pesanan, nama, atau email"
            className={`${inputClass} sm:w-72`}
          />
          <button type="submit" className={buttonClass('secondary', 'md', 'shrink-0')}>
            Cari
          </button>
        </form>
      </div>

      <nav aria-label="Filter status" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-2">
          {[undefined, ...TAB_ORDER].map((s) => {
            const selected = s === status;
            const count = s ? counts?.[s] : allCount;
            return (
              <li key={s ?? 'semua'}>
                <Link
                  href={href({ status: s, page: 1 })}
                  aria-current={selected ? 'page' : undefined}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full border-[1.5px] px-4 text-sm font-semibold whitespace-nowrap ${
                    selected
                      ? 'border-action bg-action text-white'
                      : 'border-line-input bg-surface text-ink hover:bg-muted'
                  }`}
                >
                  {s ? ORDER_STATUS_LABELS[s] : 'Semua'}
                  {count !== null && count !== undefined && (
                    <span className={`tabular-nums ${selected ? '' : 'text-ink-2'}`}>{count}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {state.status === 'loading' ? (
        <div role="status" className="flex flex-col gap-2">
          <span className="sr-only">Memuat pesanan...</span>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} aria-hidden className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : state.status === 'error' ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-line bg-surface p-6">
          <p role="alert" className="font-semibold text-danger">
            {state.message}
          </p>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className={buttonClass('secondary', 'sm')}
          >
            Coba Lagi
          </button>
        </div>
      ) : state.data.items.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-6">
          <p className="font-semibold">
            {q
              ? `Tidak ada pesanan yang cocok dengan "${q}".`
              : status
                ? `Belum ada pesanan dengan status ${ORDER_STATUS_LABELS[status]}.`
                : 'Belum ada pesanan.'}
          </p>
        </div>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
            {state.data.items.map((order) => (
              <li key={order.orderNumber}>
                <Link
                  href={`/admin/pesanan/${encodeURIComponent(order.orderNumber)}`}
                  className="grid gap-x-4 gap-y-1 p-4 hover:bg-page sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_8rem_10rem] sm:items-center"
                >
                  <span className="flex flex-col">
                    <span className="font-mono text-sm font-semibold">{order.orderNumber}</span>
                    <span className="text-xs text-ink-2">
                      {dateTime.format(new Date(order.createdAt))} WIB
                    </span>
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold">{order.customerName}</span>
                    <span className="truncate text-xs text-ink-2">
                      {order.itemCount} barang · {courierName(order.courier)} {order.courierService}
                      {order.trackingNumber && ` · resi ${order.trackingNumber}`}
                    </span>
                  </span>
                  <span className="font-bold sm:text-right">{formatRupiah(order.total)}</span>
                  <span className="sm:justify-self-end">
                    <OrderStatusChip status={order.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {totalPages > 1 && (
            <nav aria-label="Halaman pesanan" className="flex items-center justify-between gap-4">
              {page > 1 ? (
                <Link href={href({ page: page - 1 })} className={buttonClass('secondary', 'md')}>
                  Sebelumnya
                </Link>
              ) : (
                <span />
              )}
              <p className="text-sm text-ink-2">
                Halaman {page} dari {totalPages}
              </p>
              {page < totalPages ? (
                <Link href={href({ page: page + 1 })} className={buttonClass('secondary', 'md')}>
                  Berikutnya
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
