/**
 * Satu-satunya client DOKU (DOKU Checkout, format non-SNAP).
 * Dokumentasi:
 * - Buat pembayaran: https://developers.doku.com/accept-payments/doku-checkout/integration-guide/backend-integration
 * - Signature: https://developers.doku.com/get-started-with-doku-api/signature-component/non-snap/signature-component-from-request-header
 * - Notifikasi: https://developers.doku.com/get-started-with-doku-api/notification/http-notification-sample-non-snap
 * - Cek status: https://developers.doku.com/get-started-with-doku-api/check-status-api/non-snap
 */
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { logger } from './logger.js';

const TIMEOUT_MS = 15_000;

const ENDPOINTS = {
  sandbox: {
    api: 'https://api-sandbox.doku.com',
    checkoutScript: 'https://sandbox.doku.com/jokul-checkout-js/v1/jokul-checkout-1.0.0.js',
  },
  production: {
    api: 'https://api.doku.com',
    checkoutScript: 'https://jokul.doku.com/jokul-checkout-js/v1/jokul-checkout-1.0.0.js',
  },
} as const;

export class DokuError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'DokuError';
  }
}

function credentials() {
  const clientId = env.DOKU_CLIENT_ID;
  const secretKey = env.DOKU_SECRET_KEY;
  if (!clientId || !secretKey)
    throw new DokuError(503, 'DOKU_CLIENT_ID/DOKU_SECRET_KEY belum diisi');
  return { clientId, secretKey };
}

/** URL script pop-up DOKU Checkout sesuai DOKU_ENV (frontend tidak menentukan sendiri). */
export function checkoutScriptUrl(): string {
  return ENDPOINTS[env.DOKU_ENV].checkoutScript;
}

/** Digest = base64(SHA-256(body JSON mentah)). */
export function digestOf(body: string | Buffer): string {
  return createHash('sha256').update(body).digest('base64');
}

export interface SignatureParts {
  clientId: string;
  requestId: string;
  /** ISO 8601 UTC tanpa milidetik, mis. 2020-08-11T08:45:42Z. */
  timestamp: string;
  /** Path saja, mis. /checkout/v1/payment; untuk notifikasi = path Notification URL kita. */
  target: string;
  /** Kosong untuk GET. */
  digest?: string;
}

/** Komponen dipisah "\n" tanpa newline di akhir; Digest hanya untuk request ber-body. */
export function signatureComponent(parts: SignatureParts): string {
  const lines = [
    `Client-Id:${parts.clientId}`,
    `Request-Id:${parts.requestId}`,
    `Request-Timestamp:${parts.timestamp}`,
    `Request-Target:${parts.target}`,
  ];
  if (parts.digest) lines.push(`Digest:${parts.digest}`);
  return lines.join('\n');
}

export function sign(parts: SignatureParts, secretKey: string): string {
  const hmac = createHmac('sha256', secretKey).update(signatureComponent(parts)).digest('base64');
  return `HMACSHA256=${hmac}`;
}

export function dokuTimestamp(now: Date): string {
  return now.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export interface NotificationHeaders {
  clientId: string | undefined;
  requestId: string | undefined;
  timestamp: string | undefined;
  signature: string | undefined;
}

/**
 * Verifikasi signature notifikasi DOKU sebelum memproses apa pun.
 * Client-Id harus milik kita; Digest dihitung dari body mentah (bukan JSON yang sudah di-parse).
 */
export function verifyNotificationSignature(
  headers: NotificationHeaders,
  rawBody: Buffer,
  target: string,
): boolean {
  const { clientId, secretKey } = credentials();
  if (!headers.signature || !headers.requestId || !headers.timestamp) return false;
  if (headers.clientId !== clientId) return false;
  const expected = sign(
    {
      clientId,
      requestId: headers.requestId,
      timestamp: headers.timestamp,
      target,
      digest: digestOf(rawBody),
    },
    secretKey,
  );
  const a = Buffer.from(expected);
  const b = Buffer.from(headers.signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const { clientId, secretKey } = credentials();
  const requestId = randomUUID();
  const timestamp = dokuTimestamp(new Date());
  const json = body === undefined ? undefined : JSON.stringify(body);
  const signature = sign(
    {
      clientId,
      requestId,
      timestamp,
      target: path,
      ...(json !== undefined && { digest: digestOf(json) }),
    },
    secretKey,
  );

  let res: Response;
  try {
    res = await fetch(`${ENDPOINTS[env.DOKU_ENV].api}${path}`, {
      method,
      headers: {
        'Client-Id': clientId,
        'Request-Id': requestId,
        'Request-Timestamp': timestamp,
        Signature: signature,
        ...(json !== undefined && { 'Content-Type': 'application/json' }),
      },
      ...(json !== undefined && { body: json }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    logger.warn(
      { path, reason: err instanceof Error ? err.name : String(err) },
      'DOKU tidak bisa dihubungi',
    );
    throw new DokuError(503, 'DOKU tidak bisa dihubungi');
  }

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!res.ok) {
    // error_messages tidak berisi data rahasia; aman untuk log.
    logger.warn(
      { path, status: res.status, body: parsed ?? text.slice(0, 500) },
      'DOKU menolak permintaan',
    );
    throw new DokuError(res.status, `DOKU menolak permintaan (HTTP ${res.status})`);
  }
  return parsed as T;
}

export interface CreateCheckoutInput {
  invoiceNumber: string;
  /** Rupiah, integer. */
  amount: number;
  /** Batas bayar di halaman DOKU, dalam menit. */
  dueMinutes: number;
  customer: { id?: string; name: string; email: string; phone: string };
  /** Halaman tujuan setelah bayar (hanya tampilan; status tetap dari webhook). */
  callbackUrl: string;
  /** Bila diisi, menggantikan Notification URL di back office (path harus sama). */
  notificationUrl?: string;
}

export interface CheckoutPayment {
  url: string;
  tokenId: string | null;
  sessionId: string | null;
  /** Dari DOKU: yyyyMMddHHmmss, UTC+7. */
  expiredDate: string | null;
}

export async function createCheckoutPayment(input: CreateCheckoutInput): Promise<CheckoutPayment> {
  const response = await call<{
    response?: {
      payment?: { url?: string; token_id?: string; expired_date?: string };
      order?: { session_id?: string };
    };
  }>('POST', '/checkout/v1/payment', {
    order: {
      amount: input.amount,
      invoice_number: input.invoiceNumber,
      callback_url: input.callbackUrl,
      auto_redirect: true,
    },
    payment: { payment_due_date: input.dueMinutes },
    customer: {
      ...(input.customer.id && { id: input.customer.id }),
      name: input.customer.name,
      email: input.customer.email,
      phone: input.customer.phone,
    },
    ...(input.notificationUrl && {
      additional_info: { override_notification_url: input.notificationUrl },
    }),
  });

  const url = response?.response?.payment?.url;
  if (!url) throw new DokuError(502, 'Respons DOKU tidak berisi URL pembayaran');
  return {
    url,
    tokenId: response.response?.payment?.token_id ?? null,
    sessionId: response.response?.order?.session_id ?? null,
    expiredDate: response.response?.payment?.expired_date ?? null,
  };
}

export type DokuTransactionStatus =
  'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED' | 'REFUNDED' | 'TIMEOUT' | 'REDIRECT';

export interface DokuOrderStatus {
  invoiceNumber: string;
  amount: number;
  status: DokuTransactionStatus | string;
  /** Kanal bayar, mis. VIRTUAL_ACCOUNT_BCA; null bila pembeli belum memilih. */
  channel: string | null;
  raw: unknown;
}

/** Cek status ke DOKU (cadangan bila webhook terlambat). */
export async function getCheckoutStatus(invoiceNumber: string): Promise<DokuOrderStatus> {
  const raw = await call<{
    order?: { invoice_number?: string; amount?: number | string };
    transaction?: { status?: string };
    channel?: { id?: string };
  }>('GET', `/orders/v1/status/${encodeURIComponent(invoiceNumber)}`);
  return {
    invoiceNumber: raw?.order?.invoice_number ?? invoiceNumber,
    amount: Number(raw?.order?.amount ?? NaN),
    status: raw?.transaction?.status ?? 'PENDING',
    channel: raw?.channel?.id ?? null,
    raw,
  };
}
