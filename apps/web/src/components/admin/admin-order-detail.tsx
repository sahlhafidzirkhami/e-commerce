'use client';

import { ORDER_STATUS_LABELS, type AdminOrderDetail } from '@sportswear/shared';
import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { OrderStatusChip } from '@/components/order/order-status-chip';
import { Sheet } from '@/components/ui/sheet';
import { buttonClass, inputClass } from '@/components/ui/styles';
import { adminApi } from '@/lib/admin-client';
import { errorMessage } from '@/lib/api-client';
import { courierName } from '@/lib/couriers';
import { formatRupiah } from '@/lib/format';

const dateTime = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Jakarta',
});

const CANCELLABLE = new Set(['pending', 'paid', 'processing']);

type Load =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; order: AdminOrderDetail };

export function AdminOrderDetailView({ orderNumber }: { orderNumber: string }) {
  const [state, setState] = useState<Load>({ status: 'loading' });
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      setState({ status: 'ready', order: await adminApi.order(orderNumber) });
    } catch (err) {
      setState({ status: 'error', message: errorMessage(err, 'Pesanan gagal dimuat.') });
    }
  }, [orderNumber]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<AdminOrderDetail>, onDone?: () => void) {
    setPending(true);
    setActionError(null);
    try {
      setState({ status: 'ready', order: await action() });
      onDone?.();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  if (state.status === 'loading') {
    return (
      <p role="status" className="text-ink-2">
        Memuat pesanan...
      </p>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="alert" className="font-semibold text-danger">
          {state.message}
        </p>
        <Link href="/admin/pesanan" className={buttonClass('secondary', 'md')}>
          Kembali ke Daftar Pesanan
        </Link>
      </div>
    );
  }

  const { order } = state;
  const wasPaid = order.paidAt !== null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/pesanan"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-ink-2 hover:text-ink"
        >
          Kembali ke daftar pesanan
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-xl font-bold sm:text-2xl">{order.orderNumber}</h1>
          <OrderStatusChip status={order.status} />
        </div>
        <p className="mt-1 text-sm text-ink-2">
          Dibuat {dateTime.format(new Date(order.createdAt))} WIB ·{' '}
          {order.isGuest ? 'Pembeli tamu' : 'Member'}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          {/* Satu tindakan utama per status (DESIGN.md: Admin Panel). */}
          <section
            aria-labelledby="action-heading"
            className="rounded-2xl border border-line bg-surface p-4 sm:p-6"
          >
            <h2 id="action-heading" className="font-display text-lg font-semibold">
              Tindakan
            </h2>
            <div className="mt-3 flex flex-col gap-3">
              {order.status === 'pending' && (
                <p className="text-sm text-ink-2">
                  Menunggu pembayaran sampai {dateTime.format(new Date(order.expiresAt))} WIB. Tidak
                  ada tindakan yang diperlukan.
                </p>
              )}
              {order.status === 'paid' && (
                <>
                  <p className="text-sm text-ink-2">
                    Pembayaran sudah diterima. Kemas pesanan ini.
                  </p>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void run(() => adminApi.process(order.orderNumber))}
                    className={buttonClass('primary', 'md', 'self-start')}
                  >
                    {pending ? 'Memproses...' : 'Proses Pesanan'}
                  </button>
                </>
              )}
              {order.status === 'processing' && (
                <form
                  onSubmit={(event: FormEvent) => {
                    event.preventDefault();
                    void run(
                      () => adminApi.ship(order.orderNumber, trackingNumber),
                      () => setTrackingNumber(''),
                    );
                  }}
                  className="flex flex-col gap-2"
                >
                  <label htmlFor="tracking" className="text-[13px] font-semibold">
                    Nomor resi {courierName(order.shipping.courier)} {order.shipping.service}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <input
                      id="tracking"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      autoComplete="off"
                      placeholder="Salin dari bukti kirim"
                      className={`${inputClass} font-mono uppercase sm:max-w-xs`}
                    />
                    <button
                      type="submit"
                      disabled={pending || trackingNumber.trim().length === 0}
                      className={buttonClass('primary', 'md')}
                    >
                      {pending ? 'Menyimpan...' : 'Simpan Resi dan Kirim'}
                    </button>
                  </div>
                  <p className="text-xs text-ink-2">
                    Status menjadi Dikirim dan pembeli bisa melacak paket dengan nomor ini.
                  </p>
                </form>
              )}
              {order.status === 'shipped' && (
                <>
                  <p className="text-sm text-ink-2">
                    Resi {order.shipping.trackingNumber}. Tandai diterima setelah kurir menyatakan
                    paket sampai. Pesanan otomatis selesai 3 hari setelahnya.
                  </p>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void run(() => adminApi.deliver(order.orderNumber))}
                    className={buttonClass('primary', 'md', 'self-start')}
                  >
                    {pending ? 'Menyimpan...' : 'Tandai Diterima'}
                  </button>
                </>
              )}
              {['delivered', 'completed', 'expired', 'cancelled'].includes(order.status) && (
                <p className="text-sm text-ink-2">
                  Pesanan berstatus {ORDER_STATUS_LABELS[order.status]}. Tidak ada tindakan lagi.
                </p>
              )}
              {CANCELLABLE.has(order.status) && (
                <button
                  type="button"
                  onClick={() => setCancelOpen(true)}
                  className={buttonClass(
                    'ghost',
                    'sm',
                    'self-start text-danger hover:text-danger-hover',
                  )}
                >
                  Batalkan pesanan
                </button>
              )}
              {actionError && (
                <p role="alert" className="text-sm font-semibold text-danger">
                  {actionError}
                </p>
              )}
            </div>
          </section>

          <section
            aria-labelledby="items-heading"
            className="rounded-2xl border border-line bg-surface p-4 sm:p-6"
          >
            <h2 id="items-heading" className="font-display text-lg font-semibold">
              Barang
            </h2>
            <ul className="mt-2 divide-y divide-line">
              {order.items.map((item) => (
                <li key={item.sku} className="flex justify-between gap-4 py-3 text-sm">
                  <span>
                    <span className="font-semibold">{item.productName}</span>
                    <br />
                    <span className="text-ink-2">
                      {item.variantLabel} · <span className="font-mono">{item.sku}</span> ·{' '}
                      {item.quantity} × {formatRupiah(item.price)}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold">{formatRupiah(item.subtotal)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-2 flex flex-col gap-1 border-t border-line pt-3 text-sm">
              <Row label="Subtotal" value={formatRupiah(order.subtotal)} />
              <Row
                label={`Ongkir ${courierName(order.shipping.courier)} ${order.shipping.service} (${order.totalWeightGram} g)`}
                value={formatRupiah(order.shippingCost)}
              />
              {order.discount > 0 && (
                <Row
                  label={`Voucher ${order.voucherCode ?? ''}`}
                  value={`-${formatRupiah(order.discount)}`}
                />
              )}
              <div className="flex justify-between gap-4 pt-1 text-base">
                <dt className="font-semibold">Total</dt>
                <dd className="font-bold">{formatRupiah(order.total)}</dd>
              </div>
            </dl>
            {order.notes && (
              <p className="mt-3 rounded-xl bg-muted p-3 text-sm">
                <span className="font-semibold">Catatan pembeli:</span> {order.notes}
              </p>
            )}
          </section>

          <section
            aria-labelledby="history-heading"
            className="rounded-2xl border border-line bg-surface p-4 sm:p-6"
          >
            <h2 id="history-heading" className="font-display text-lg font-semibold">
              Riwayat status
            </h2>
            <ol className="mt-3 flex flex-col gap-3">
              {[...order.history].reverse().map((h, index) => (
                <li key={`${h.toStatus}-${h.createdAt}`} className="flex gap-3 text-sm">
                  <span
                    aria-hidden
                    className={`mt-1.5 size-2.5 shrink-0 rounded-full ${
                      index === 0 ? 'bg-action' : 'border-2 border-line-input'
                    }`}
                  />
                  <span>
                    <span className="font-semibold">{ORDER_STATUS_LABELS[h.toStatus]}</span>
                    {h.note && <span className="text-ink-2"> · {h.note}</span>}
                    <br />
                    <span className="text-xs text-ink-2">
                      {dateTime.format(new Date(h.createdAt))} WIB
                      {h.changedBy ? ` · oleh ${h.changedBy}` : ' · otomatis'}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section
            aria-labelledby="buyer-heading"
            className="rounded-2xl border border-line bg-surface p-4 sm:p-6"
          >
            <h2 id="buyer-heading" className="font-display text-lg font-semibold">
              Pembeli
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              <span className="font-semibold">{order.customerName}</span>
              <br />
              {order.customerEmail}
              <br />
              {order.customerPhone}
            </p>
            <h3 className="mt-4 text-sm font-semibold">Dikirim ke</h3>
            <p className="mt-1 text-sm leading-relaxed">
              {order.shipping.recipient} · {order.shipping.phone}
              <br />
              {order.shipping.street}
              <br />
              {order.shipping.district}, {order.shipping.city}, {order.shipping.province}{' '}
              {order.shipping.postalCode}
            </p>
          </section>

          <section
            aria-labelledby="payment-heading"
            className="rounded-2xl border border-line bg-surface p-4 sm:p-6"
          >
            <h2 id="payment-heading" className="font-display text-lg font-semibold">
              Pembayaran DOKU
            </h2>
            {order.payments.length === 0 ? (
              <p className="mt-2 text-sm text-ink-2">Pembeli belum membuka halaman bayar.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2 text-sm">
                {order.payments.map((p) => (
                  <li key={p.invoiceNumber} className="rounded-xl bg-page p-3">
                    <span className="font-mono text-xs">{p.invoiceNumber}</span>
                    <br />
                    <span className="font-semibold">{p.status}</span>
                    {p.method && <span className="text-ink-2"> · {p.method}</span>}
                    {p.paidAt && (
                      <span className="text-ink-2">
                        {' '}
                        · {dateTime.format(new Date(p.paidAt))} WIB
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <Sheet
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Batalkan pesanan?"
        side="bottom"
      >
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void run(
              () => adminApi.cancel(order.orderNumber, reason),
              () => {
                setCancelOpen(false);
                setReason('');
              },
            );
          }}
          className="flex flex-col gap-3"
        >
          <p className="text-sm">
            Stok dan kuota voucher dikembalikan. Tindakan ini tidak bisa dibatalkan.
          </p>
          {wasPaid && (
            <p className="rounded-xl bg-warning-tint p-3 text-sm font-semibold text-warning-ink">
              Pesanan ini sudah dibayar {formatRupiah(order.total)}. Kembalikan uang pembeli secara
              manual di luar sistem.
            </p>
          )}
          <label htmlFor="cancel-reason" className="text-[13px] font-semibold">
            Alasan pembatalan
          </label>
          <textarea
            id="cancel-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Contoh: stok ukuran M rusak"
            className={`${inputClass} h-auto py-3`}
          />
          {actionError && (
            <p role="alert" className="text-sm font-semibold text-danger">
              {actionError}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending || reason.trim().length < 5}
              className={buttonClass('destructive', 'md')}
            >
              {pending ? 'Membatalkan...' : 'Batalkan Pesanan'}
            </button>
            <button
              type="button"
              onClick={() => setCancelOpen(false)}
              className={buttonClass('ghost', 'md')}
            >
              Kembali
            </button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-2">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
