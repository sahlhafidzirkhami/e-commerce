import { describe, expect, it } from 'vitest';
import { formatPriceRange, formatRupiah } from './format';

// Intl memakai spasi non-breaking antara "Rp" dan angka; samakan agar mudah dibandingkan.
const normalize = (value: string) => value.replace(/\s/g, ' ');

describe('formatRupiah', () => {
  it('memformat dengan pemisah ribuan titik', () => {
    expect(normalize(formatRupiah(150000))).toBe('Rp 150.000');
    expect(normalize(formatRupiah(1250000))).toBe('Rp 1.250.000');
  });

  it('tanpa desimal', () => {
    expect(normalize(formatRupiah(0))).toBe('Rp 0');
  });
});

describe('formatPriceRange', () => {
  it('satu harga bila semua ukuran sama', () => {
    expect(normalize(formatPriceRange(189900, 189900))).toBe('Rp 189.900');
  });

  it('awalan "mulai" bila harga antar ukuran berbeda', () => {
    expect(normalize(formatPriceRange(189900, 209900))).toBe('mulai Rp 189.900');
  });
});
