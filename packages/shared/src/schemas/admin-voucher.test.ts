import { describe, expect, it } from 'vitest';
import { voucherInputSchema, voucherState } from './admin-voucher.js';

const base = {
  code: 'lari20',
  type: 'PERCENT' as const,
  value: 20,
  maxDiscount: 50000,
  minPurchase: 200000,
  quota: 100,
  startsAt: '2026-10-01T00:00:00.000Z',
  endsAt: '2026-10-31T16:59:59.000Z',
  isActive: true,
};

function firstError(input: unknown) {
  const result = voucherInputSchema.safeParse(input);
  return result.success ? null : result.error.issues[0]?.message;
}

describe('voucherInputSchema', () => {
  it('menerima voucher persen yang valid dan menjadikan kode huruf besar', () => {
    const parsed = voucherInputSchema.parse(base);
    expect(parsed.code).toBe('LARI20');
    expect(parsed.startsAt).toBeInstanceOf(Date);
  });

  it('persen maksimal 100', () => {
    expect(firstError({ ...base, value: 101 })).toBe('Persen maksimal 100');
  });

  it('batas potongan hanya untuk voucher persen', () => {
    expect(firstError({ ...base, type: 'FIXED', value: 20000 })).toBe(
      'Batas potongan hanya untuk voucher persen',
    );
    expect(
      voucherInputSchema.safeParse({ ...base, type: 'FIXED', value: 20000, maxDiscount: null })
        .success,
    ).toBe(true);
  });

  it('tanggal berakhir harus setelah tanggal mulai', () => {
    expect(firstError({ ...base, endsAt: base.startsAt })).toBe(
      'Tanggal berakhir harus setelah tanggal mulai',
    );
  });

  it('nominal harus Rupiah bulat', () => {
    expect(voucherInputSchema.safeParse({ ...base, minPurchase: 1500.5 }).success).toBe(false);
  });
});

describe('voucherState', () => {
  const v = {
    isActive: true,
    startsAt: new Date('2026-10-01'),
    endsAt: new Date('2026-10-31'),
    quota: 10,
    usedCount: 0,
  };

  it('urutan prioritas: nonaktif, berakhir, kuota habis, terjadwal, aktif', () => {
    expect(voucherState({ ...v, isActive: false }, new Date('2026-10-15'))).toBe('inactive');
    expect(voucherState({ ...v, usedCount: 10 }, new Date('2026-11-02'))).toBe('ended');
    expect(voucherState({ ...v, usedCount: 10 }, new Date('2026-10-15'))).toBe('exhausted');
    expect(voucherState(v, new Date('2026-09-30'))).toBe('scheduled');
    expect(voucherState(v, new Date('2026-10-15'))).toBe('active');
  });
});
