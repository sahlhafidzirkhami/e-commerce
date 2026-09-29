import { describe, expect, it } from 'vitest';
import { formatRupiah } from './format';

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
