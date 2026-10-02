import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../lib/http-error.js';
import { calculateVoucherDiscount, type VoucherRule } from './voucher.service.js';

vi.mock('../../lib/prisma.js', () => ({ prisma: {} }));

const now = new Date('2026-10-01T05:00:00Z');

function voucher(overrides: Partial<VoucherRule> = {}): VoucherRule {
  return {
    id: 'v1',
    code: 'LARI50',
    type: 'FIXED',
    value: 50000,
    maxDiscount: null,
    minPurchase: 200000,
    quota: 100,
    usedCount: 0,
    startsAt: new Date('2026-09-01T00:00:00Z'),
    endsAt: new Date('2026-10-31T16:59:59Z'),
    isActive: true,
    ...overrides,
  };
}

function rejection(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    return err instanceof HttpError ? `${err.code}: ${err.message}` : 'bukan HttpError';
  }
  return 'tidak error';
}

describe('calculateVoucherDiscount', () => {
  it('potongan nominal', () => {
    expect(calculateVoucherDiscount(voucher(), 250000, now)).toBe(50000);
  });

  it('potongan persen dibulatkan ke bawah dan dibatasi maxDiscount', () => {
    const persen = voucher({ type: 'PERCENT', value: 15, minPurchase: 0 });
    expect(calculateVoucherDiscount(persen, 189900, now)).toBe(28485);
    expect(calculateVoucherDiscount({ ...persen, maxDiscount: 20000 }, 189900, now)).toBe(20000);
  });

  it('potongan tidak melebihi subtotal', () => {
    expect(calculateVoucherDiscount(voucher({ value: 300000, minPurchase: 0 }), 150000, now)).toBe(
      150000,
    );
  });

  it('minimal belanja inklusif', () => {
    expect(calculateVoucherDiscount(voucher(), 200000, now)).toBe(50000);
    expect(rejection(() => calculateVoucherDiscount(voucher(), 199999, now))).toBe(
      'VOUCHER_INVALID: Voucher berlaku untuk belanja minimal Rp200.000',
    );
  });

  it('menolak voucher di luar masa berlaku, habis kuota, atau nonaktif', () => {
    expect(
      rejection(() =>
        calculateVoucherDiscount(voucher({ startsAt: new Date('2026-10-02') }), 250000, now),
      ),
    ).toMatch(/belum bisa dipakai/);
    expect(
      rejection(() =>
        calculateVoucherDiscount(voucher({ endsAt: new Date('2026-09-30') }), 250000, now),
      ),
    ).toMatch(/sudah berakhir/);
    expect(
      rejection(() => calculateVoucherDiscount(voucher({ usedCount: 100 }), 250000, now)),
    ).toMatch(/Kuota voucher sudah habis/);
    expect(
      rejection(() => calculateVoucherDiscount(voucher({ isActive: false }), 250000, now)),
    ).toMatch(/tidak aktif/);
  });
});
