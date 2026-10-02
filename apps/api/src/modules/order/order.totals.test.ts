import { describe, expect, it } from 'vitest';
import { generateOrderNumber } from './order.number.js';
import { computeTotals, sumWeightGram } from './order.totals.js';

const lines = [
  { price: 189900, quantity: 2, weightGram: 200 },
  { price: 249900, quantity: 1, weightGram: 350 },
];

describe('computeTotals', () => {
  it('subtotal + ongkir - diskon, semua integer Rupiah', () => {
    expect(computeTotals(lines, 18000, 50000)).toEqual({
      subtotal: 629700,
      shippingCost: 18000,
      discount: 50000,
      total: 597700,
    });
  });

  it('diskon tidak pernah memotong ongkir', () => {
    expect(computeTotals([{ price: 100000, quantity: 1, weightGram: 200 }], 25000, 150000)).toEqual(
      {
        subtotal: 100000,
        shippingCost: 25000,
        discount: 100000,
        total: 25000,
      },
    );
  });

  it('menolak nominal pecahan atau negatif', () => {
    expect(() => computeTotals(lines, 18000.5, 0)).toThrow();
    expect(() => computeTotals(lines, 18000, -1)).toThrow();
  });

  it('berat total dikali jumlah', () => {
    expect(sumWeightGram(lines)).toBe(750);
  });
});

describe('generateOrderNumber', () => {
  it('format 3ON-YYMMDD-XXXXXX tanpa huruf I, L, O, U', () => {
    const number = generateOrderNumber(new Date('2026-10-01T03:00:00Z'));
    expect(number).toMatch(/^3ON-261001-[0-9A-HJKMNP-TV-Z]{6}$/);
  });

  it('memakai tanggal WIB: 17:30 UTC sudah berganti hari di Indonesia', () => {
    const number = generateOrderNumber(new Date('2026-10-01T17:30:00Z'), () => 0);
    expect(number).toBe('3ON-261002-000000');
  });
});
