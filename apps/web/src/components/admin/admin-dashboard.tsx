'use client';

import {
  DASHBOARD_DAYS,
  ORDER_STATUS_LABELS,
  type AdminDashboard as Dashboard,
  type OrderStatus,
} from '@sportswear/shared';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { buttonClass } from '@/components/ui/styles';
import { adminApi } from '@/lib/admin-client';
import { errorMessage } from '@/lib/api-client';
import { formatRupiah } from '@/lib/format';

type Load =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: Dashboard };

/** Status yang butuh tindakan admin, urut sesuai alur kerja. */
const WORK_QUEUE: { status: OrderStatus; label: string }[] = [
  { status: 'paid', label: 'Perlu dikemas' },
  { status: 'processing', label: 'Perlu input resi' },
  { status: 'shipped', label: 'Dalam pengiriman' },
  { status: 'pending', label: 'Menunggu pembayaran' },
];

const monthName = new Intl.DateTimeFormat('id-ID', { month: 'long', timeZone: 'Asia/Jakarta' });
const shortDate = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const timeWib = new Intl.DateTimeFormat('id-ID', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Jakarta',
});
const compactRupiah = new Intl.NumberFormat('id-ID', { notation: 'compact' });

/** "2026-10-15" (tanggal WIB) → "15 Okt". */
function dayLabel(date: string): string {
  return shortDate.format(new Date(`${date}T00:00:00Z`));
}

export function AdminDashboard() {
  const [state, setState] = useState<Load>({ status: 'loading' });

  const load = useCallback(async () => {
    try {
      setState({ status: 'ready', data: await adminApi.dashboard() });
    } catch (err) {
      setState({ status: 'error', message: errorMessage(err, 'Dashboard gagal dimuat.') });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.status === 'loading') {
    return (
      <div role="status" className="flex flex-col gap-4">
        <span className="sr-only">Memuat dashboard...</span>
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <span key={i} aria-hidden className="h-28 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
        <span aria-hidden className="h-56 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="alert" className="font-semibold text-danger">
          {state.message}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className={buttonClass('secondary', 'md')}
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  const d = state.data;
  const generatedAt = new Date(d.generatedAt);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-headline-sm leading-tight font-bold">Dashboard</h1>
        <p className="text-sm text-ink-2">
          Per {timeWib.format(generatedAt)} WIB ·{' '}
          <button
            type="button"
            onClick={() => void load()}
            className="font-semibold text-action underline underline-offset-4"
          >
            Muat ulang
          </button>
        </p>
      </div>

      <section aria-label="Omzet" className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Omzet hari ini"
          value={formatRupiah(d.today.revenue)}
          detail={`${d.today.orders} pesanan dibayar`}
        />
        <StatCard
          label={`Omzet ${monthName.format(generatedAt)}`}
          value={formatRupiah(d.thisMonth.revenue)}
          detail={`${d.thisMonth.orders} pesanan dibayar`}
        />
      </section>

      <section aria-labelledby="queue-heading" className="flex flex-col gap-3">
        <h2 id="queue-heading" className="font-display text-lg font-semibold">
          Pesanan
        </h2>
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {WORK_QUEUE.map(({ status, label }) => (
            <li key={status}>
              <Link
                href={`/admin/pesanan?status=${status}`}
                className="flex h-full flex-col gap-1 rounded-2xl border border-line bg-surface p-4 hover:border-line-strong"
              >
                <span className="text-sm text-ink-2">{label}</span>
                <span className="font-display text-2xl font-bold tabular-nums">
                  {d.countsByStatus[status]}
                </span>
                <span className="text-xs text-ink-2">{ORDER_STATUS_LABELS[status]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <RevenueChart daily={d.daily} />

      <div className="grid gap-6 lg:grid-cols-2">
        <section
          aria-labelledby="top-heading"
          className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-6"
        >
          <h2 id="top-heading" className="font-display text-lg font-semibold">
            Terlaris {DASHBOARD_DAYS} hari terakhir
          </h2>
          {d.topProducts.length === 0 ? (
            <p className="text-sm text-ink-2">Belum ada penjualan dalam periode ini.</p>
          ) : (
            <ol className="flex flex-col divide-y divide-line">
              {d.topProducts.map((p, index) => (
                <li key={p.productId}>
                  <Link
                    href={`/admin/produk/${p.productId}`}
                    className="flex items-center gap-3 py-2 hover:bg-page"
                  >
                    <span className="w-5 shrink-0 text-right text-sm font-semibold text-ink-2 tabular-nums">
                      {index + 1}
                    </span>
                    <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {p.imageUrl && (
                        <Image src={p.imageUrl} alt="" fill sizes="44px" className="object-cover" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 text-sm font-semibold">{p.name}</span>
                      <span className="text-xs text-ink-2">{formatRupiah(p.revenue)}</span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {p.quantity} pcs
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section
          aria-labelledby="stock-heading"
          className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-6"
        >
          <h2 id="stock-heading" className="font-display text-lg font-semibold">
            Stok menipis
          </h2>
          <p className="-mt-2 text-sm text-ink-2">
            Ukuran aktif dengan stok {d.lowStockThreshold} atau kurang.
          </p>
          {d.lowStock.length === 0 ? (
            <p className="text-sm text-ink-2">Semua stok aman.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {d.lowStock.map((v) => (
                <li key={v.sku}>
                  <Link
                    href={`/admin/produk/${v.productId}`}
                    className="flex items-center justify-between gap-3 py-2 hover:bg-page"
                  >
                    <span className="min-w-0">
                      <span className="line-clamp-1 text-sm font-semibold">{v.productName}</span>
                      <span className="font-mono text-xs text-ink-2">
                        {v.size} · {v.sku}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-sm px-2 py-0.5 text-xs font-semibold tabular-nums ${
                        v.stock === 0
                          ? 'bg-error-tint text-error-ink'
                          : 'bg-warning-tint text-warning-ink'
                      }`}
                    >
                      {v.stock === 0 ? 'Habis' : `Sisa ${v.stock}`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4 sm:p-6">
      <span className="text-sm text-ink-2">{label}</span>
      <span className="font-display text-2xl font-bold tabular-nums sm:text-3xl">{value}</span>
      <span className="text-sm text-ink-2">{detail}</span>
    </div>
  );
}

/** Grafik batang CSS tanpa library; angka lengkap tersedia untuk pembaca layar. */
function RevenueChart({ daily }: { daily: Dashboard['daily'] }) {
  const max = Math.max(...daily.map((x) => x.revenue), 1);
  const total = daily.reduce((sum, x) => sum + x.revenue, 0);
  const first = daily[0];
  const last = daily.at(-1);

  return (
    <section
      aria-labelledby="chart-heading"
      className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="chart-heading" className="font-display text-lg font-semibold">
          Omzet {DASHBOARD_DAYS} hari terakhir
        </h2>
        <span className="text-sm font-semibold">{formatRupiah(total)}</span>
      </div>
      <div aria-hidden className="flex h-40 items-end gap-[2px] sm:gap-1">
        {daily.map((x) => (
          <div
            key={x.date}
            title={`${dayLabel(x.date)}: ${formatRupiah(x.revenue)} (${x.orders} pesanan)`}
            className="group relative flex h-full flex-1 items-end"
          >
            <div
              className={`w-full rounded-t-sm ${x.revenue > 0 ? 'bg-action group-hover:bg-action-hover' : 'bg-muted'}`}
              style={{ height: x.revenue > 0 ? `${Math.max(4, (x.revenue / max) * 100)}%` : '2px' }}
            />
          </div>
        ))}
      </div>
      <div aria-hidden className="flex justify-between text-xs text-ink-2">
        <span>{first && dayLabel(first.date)}</span>
        <span>Tertinggi {compactRupiah.format(max === 1 ? 0 : max)}</span>
        <span>{last && dayLabel(last.date)}</span>
      </div>
      <table className="sr-only">
        <caption>Omzet per hari</caption>
        <thead>
          <tr>
            <th scope="col">Tanggal</th>
            <th scope="col">Omzet</th>
            <th scope="col">Pesanan</th>
          </tr>
        </thead>
        <tbody>
          {daily.map((x) => (
            <tr key={x.date}>
              <td>{dayLabel(x.date)}</td>
              <td>{formatRupiah(x.revenue)}</td>
              <td>{x.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
