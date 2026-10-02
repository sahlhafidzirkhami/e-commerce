import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  digestOf,
  dokuTimestamp,
  sign,
  signatureComponent,
  verifyNotificationSignature,
} from './doku.js';

vi.mock('../config/env.js', async (original) => {
  const actual = await original<{ env: Record<string, unknown> }>();
  return {
    env: {
      ...actual.env,
      DOKU_CLIENT_ID: 'BRN-0001-TEST',
      DOKU_SECRET_KEY: 'SK-rahasia-test',
      DOKU_ENV: 'sandbox',
    },
  };
});

const body = Buffer.from(
  '{"order":{"invoice_number":"3ON-261001-K7Q2M9-AB12","amount":170000},"transaction":{"status":"SUCCESS"}}',
);

function headersFor(rawBody: Buffer, overrides: Partial<Record<string, string>> = {}) {
  const parts = {
    clientId: 'BRN-0001-TEST',
    requestId: 'b1f7c0de-1111-2222-3333-444455556666',
    timestamp: '2026-10-01T08:45:42Z',
    target: '/api/webhooks/doku',
    digest: digestOf(rawBody),
  };
  return {
    clientId: overrides.clientId ?? parts.clientId,
    requestId: overrides.requestId ?? parts.requestId,
    timestamp: overrides.timestamp ?? parts.timestamp,
    signature: overrides.signature ?? sign(parts, 'SK-rahasia-test'),
  };
}

describe('signature DOKU (non-SNAP)', () => {
  it('komponen persis seperti contoh resmi: dipisah \\n, tanpa newline di akhir', () => {
    expect(
      signatureComponent({
        clientId: 'MCH-0001-10791114622547',
        requestId: 'cc682442-6c22-493e-8121-b9ef6b3fa728',
        timestamp: '2020-08-11T08:45:42Z',
        target: '/doku-virtual-account/v2/payment-code',
        digest: '5WIYK2TJg6iiZ0d5v4IXSR0EkYEkYOezJIma3Ufli5s=',
      }),
    ).toBe(
      'Client-Id:MCH-0001-10791114622547\nRequest-Id:cc682442-6c22-493e-8121-b9ef6b3fa728\nRequest-Timestamp:2020-08-11T08:45:42Z\nRequest-Target:/doku-virtual-account/v2/payment-code\nDigest:5WIYK2TJg6iiZ0d5v4IXSR0EkYEkYOezJIma3Ufli5s=',
    );
  });

  it('request GET tidak memakai Digest', () => {
    expect(
      signatureComponent({
        clientId: 'c',
        requestId: 'r',
        timestamp: 't',
        target: '/orders/v1/status/X',
      }),
    ).toBe('Client-Id:c\nRequest-Id:r\nRequest-Timestamp:t\nRequest-Target:/orders/v1/status/X');
  });

  it('signature = "HMACSHA256=" + base64(HMAC-SHA256(komponen, secret))', () => {
    const parts = { clientId: 'c', requestId: 'r', timestamp: 't', target: '/x', digest: 'd' };
    const expected = createHmac('sha256', 'secret')
      .update(signatureComponent(parts))
      .digest('base64');
    expect(sign(parts, 'secret')).toBe(`HMACSHA256=${expected}`);
  });

  it('digest = base64(SHA-256(body))', () => {
    expect(digestOf('')).toBe('47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=');
  });

  it('timestamp ISO 8601 UTC tanpa milidetik', () => {
    expect(dokuTimestamp(new Date('2026-10-01T08:45:42.123Z'))).toBe('2026-10-01T08:45:42Z');
  });
});

describe('verifyNotificationSignature', () => {
  it('menerima notifikasi bersignature benar', () => {
    expect(verifyNotificationSignature(headersFor(body), body, '/api/webhooks/doku')).toBe(true);
  });

  it('menolak body yang diubah setelah ditandatangani', () => {
    const tampered = Buffer.from(body.toString().replace('170000', '1700'));
    expect(verifyNotificationSignature(headersFor(body), tampered, '/api/webhooks/doku')).toBe(
      false,
    );
  });

  it('menolak Client-Id lain, path lain, header kurang, atau signature palsu', () => {
    expect(
      verifyNotificationSignature(
        headersFor(body, { clientId: 'BRN-LAIN' }),
        body,
        '/api/webhooks/doku',
      ),
    ).toBe(false);
    expect(verifyNotificationSignature(headersFor(body), body, '/api/lain')).toBe(false);
    expect(
      verifyNotificationSignature(
        { ...headersFor(body), signature: undefined },
        body,
        '/api/webhooks/doku',
      ),
    ).toBe(false);
    expect(
      verifyNotificationSignature(
        headersFor(body, { signature: 'HMACSHA256=palsu' }),
        body,
        '/api/webhooks/doku',
      ),
    ).toBe(false);
  });
});
