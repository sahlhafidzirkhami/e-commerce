'use client';

import type { OrderView } from '@sportswear/shared';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { buttonClass } from '@/components/ui/styles';
import { errorMessage } from '@/lib/api-client';
import { checkoutApi } from '@/lib/checkout-client';
import { openDokuCheckout } from '@/lib/doku-checkout';
import { formatRupiah } from '@/lib/format';
import { OrderStatusChip } from './order-status-chip';

/** Polling status saat menunggu pembayaran; server juga bertanya ke DOKU bila webhook telat. */
const POLL_INTERVAL_MS = 5_000;

const dateTime = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Jakarta',
});

type Load =
  | { status: 'loading' }
  | { status: 'error'; message: string; notFound: boolean }
  | { status: 'ready'; order: OrderView };

export function OrderPageView({ orderNumber }: { orderNumber: string }) {
  const params = useSearchParams();
  const token = params.get('token');
  const autoPay = params.get('bayar') === '1';

  const [state, setState] = useState<Load>({ status: 'loading' });
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const autoPayDone = useRef(false);

  const load = useCallback(async () => {
    try {
      setState({ status: 'ready', order: await checkoutApi.order(orderNumber, token) });
    } catch (err) {
      setState({
        status: 'error',
        message: errorMessage(err, 'Pesanan gagal dimuat.'),
        notFound: err instanceof Error && 'status' in err && err.status === 404,
      });
    }
  }, [orderNumber, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const pay = useCallback(async () => {
    setPaying(true);
    setPayError(null);
    try {
      const session = await checkoutApi.startPayment(orderNumber, token);
      await openDokuCheckout(session.paymentUrl, session.checkoutScriptUrl);
    } catch (err) {
      setPayError(errorMessage(err, 'Halaman pembayaran gagal dibuka. Coba lagi.'));
    } finally {
      setPaying(false);
    }
  }, [orderNumber, token]);

  const pending = state.status === 'ready' && state.order.status === 'pending';

  // Dari checkout: langsung buka pop-up pembayaran sekali.
  useEffect(() => {
    if (pending && autoPay && !autoPayDone.current) {
      autoPayDone.current = true;
      void pay();
    }
  }, [pending, autoPay, pay]);

  // Selama pending: cek status berkala, hanya saat tab terlihat.
  useEffect(() => {
    if (!pending) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      checkoutApi
        .checkPayment(orderNumber, token)
        .then((order) => setState({ status: 'ready', order }))
        .catch(() => undefined);
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [pending, orderNumber, token]);

  if (state.status === 'loading') {
    return (
      <Shell title="Pesanan">
        <p role="status" className="text-ink-2">
          Memuat pesanan...
        </p>
      </Shell>
    );
  }
  if (state.status === 'error') {
    return (
      <Shell title={state.notFound ? 'Pesanan tidak ditemukan' : 'Pesanan gagal dimuat'}>
        <p className="max-w-prose text-ink-2">
          {state.notFound
            ? 'Tautan pesanan ini salah atau sudah tidak berlaku. Buka tautan dari email konfirmasi.'
            : state.message}
        </p>
        {!state.notFound && (
          <button
            type="button"
            onClick={() => void load()}
            className={buttonClass('primary', 'md')}
          >
            Coba Lagi
          </button>
        )}
      </Shell>
    );
  }

  const { order } = state;
  return (
    <main className="mx-auto max-w-3xl px-4 pt-6 pb-14 md:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-headline-sm leading-tight font-bold">Pesanan</h1>
        <OrderStatusChip status={order.status} />
      </div>
      <p className="mt-1 font-mono text-sm text-ink-2">{order.orderNumber}</p>

      <section
        aria-live="polite"
        className="mt-6 rounded-2xl border border-line bg-surface p-4 sm:p-6"
      >
        {order.status === 'pending' && (
          <div className="flex flex-col gap-3">
            <p className="font-semibold">
              Bayar {formatRupiah(order.total)} sebelum {dateTime.format(new Date(order.expiresAt))}{' '}
              WIB.
            </p>
            <p className="text-sm text-ink-2">
              Lewat dari itu pesanan dibatalkan otomatis dan stok dikembalikan. Halaman ini
              diperbarui sendiri setelah pembayaran diterima.
            </p>
            {payError && (
              <p role="alert" className="text-sm font-semibold text-danger">
                {payError}
              </p>
            )}
            <button
              type="button"
              onClick={() => void pay()}
              disabled={paying}
              className={buttonClass('primary', 'lg', 'self-start')}
            >
              {paying ? 'Membuka pembayaran...' : 'Bayar Sekarang'}
            </button>
          </div>
        )}
        {order.status === 'paid' && (
          <p className="font-semibold">
            Pembayaran diterima
            {order.paidAt ? ` pada ${dateTime.format(new Date(order.paidAt))} WIB` : ''}. Pesanan
            segera dikemas.
          </p>
        )}
        {order.status === 'expired' && (
          <div className="flex flex-col items-start gap-3">
            <p className="font-semibold">Pesanan dibatalkan karena tidak dibayar dalam 3 jam.</p>
            <Link href="/produk" className={buttonClass('primary', 'md')}>
              Belanja Lagi
            </Link>
          </div>
        )}
        {order.status === 'cancelled' && <p className="font-semibold">Pesanan ini dibatalkan.</p>}
        {['processing', 'shipped', 'delivered', 'completed'].includes(order.status) && (
          <p className="font-semibold">
            {order.shipping.trackingNumber
              ? `Nomor resi ${order.shipping.courier.toUpperCase()}: ${order.shipping.trackingNumber}`
              : 'Pesanan sedang diproses.'}
          </p>
        )}
      </section>

      <section aria-labelledby="items-heading" className="mt-6">
        <h2 id="items-heading" className="font-display text-lg font-semibold">
          Barang
        </h2>
        <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface px-4">
          {order.items.map((item) => (
            <li key={item.sku} className="flex justify-between gap-4 py-3 text-sm">
              <span>
                <span className="font-semibold">{item.productName}</span>
                <br />
                <span className="text-ink-2">
                  {item.variantLabel} · {item.quantity} × {formatRupiah(item.price)}
                </span>
              </span>
              <span className="shrink-0 font-semibold">{formatRupiah(item.subtotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 flex flex-col gap-2 text-sm">
          <Row label="Subtotal" value={formatRupiah(order.subtotal)} />
          <Row
            label={`Ongkir ${order.shipping.courier.toUpperCase()} ${order.shipping.service}`}
            value={formatRupiah(order.shippingCost)}
          />
          {order.discount > 0 && (
            <Row
              label={`Voucher ${order.voucherCode ?? ''}`}
              value={`-${formatRupiah(order.discount)}`}
            />
          )}
          <div className="flex justify-between gap-4 border-t border-line pt-2 text-base">
            <dt className="font-semibold">Total</dt>
            <dd className="font-bold">{formatRupiah(order.total)}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="address-heading" className="mt-6">
        <h2 id="address-heading" className="font-display text-lg font-semibold">
          Dikirim ke
        </h2>
        <p className="mt-2 text-sm leading-relaxed">
          <span className="font-semibold">{order.shipping.recipient}</span> · {order.shipping.phone}
          <br />
          {order.shipping.street}
          <br />
          {order.shipping.district}, {order.shipping.city}, {order.shipping.province}{' '}
          {order.shipping.postalCode}
        </p>
      </section>
    </main>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-start gap-4 px-4 pt-6 pb-14 md:px-6">
      <h1 className="font-display text-headline-sm leading-tight font-bold">{title}</h1>
      {children}
    </main>
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
