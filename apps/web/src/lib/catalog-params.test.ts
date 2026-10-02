import { describe, expect, it } from 'vitest';
import { catalogHref, hasActiveFilters, parseCatalogParams } from './catalog-params';

describe('parseCatalogParams', () => {
  it('membaca parameter berbahasa Indonesia dari URL', () => {
    const { filters, priceError } = parseCatalogParams({
      kategori: 'kaos',
      ukuran: 'M',
      q: 'lumina',
      min: '100000',
      max: '250000',
      urut: 'price_asc',
      halaman: '2',
    });
    expect(filters).toEqual({
      category: 'kaos',
      size: 'M',
      q: 'lumina',
      minPrice: 100000,
      maxPrice: 250000,
      sort: 'price_asc',
      page: 2,
    });
    expect(priceError).toBeNull();
  });

  it('mengabaikan rentang harga terbalik dan memberi pesan', () => {
    const { filters, priceError } = parseCatalogParams({ min: '300000', max: '100000' });
    expect(filters.minPrice).toBeUndefined();
    expect(filters.maxPrice).toBeUndefined();
    expect(priceError).toMatch(/harga/);
  });

  it('parameter tidak dikenal jatuh ke default tanpa error', () => {
    const { filters } = parseCatalogParams({ urut: 'acak', halaman: 'x', kategori: 'kaos' });
    expect(filters).toEqual({ category: 'kaos', sort: 'newest', page: 1 });
  });
});

describe('catalogHref', () => {
  const current = { category: 'kaos', size: 'M', sort: 'price_asc' as const, page: 3 };

  it('mengubah filter kembali ke halaman 1', () => {
    expect(catalogHref('/produk', current, { size: 'L' })).toBe(
      '/produk?kategori=kaos&ukuran=L&urut=price_asc',
    );
  });

  it('mempertahankan filter saat pindah halaman', () => {
    expect(catalogHref('/produk', current, { page: 4 })).toBe(
      '/produk?kategori=kaos&ukuran=M&urut=price_asc&halaman=4',
    );
  });

  it('menghapus filter dan tidak menulis urutan default', () => {
    expect(catalogHref('/produk', current, { size: undefined, sort: 'newest' })).toBe(
      '/produk?kategori=kaos',
    );
  });

  it('halaman kategori tidak mengulang kategori di query string', () => {
    expect(catalogHref('/kategori/kaos', current, {}, { includeCategory: false })).toBe(
      '/kategori/kaos?ukuran=M&urut=price_asc',
    );
  });
});

describe('hasActiveFilters', () => {
  it('urutan dan halaman bukan filter', () => {
    expect(hasActiveFilters({ sort: 'bestselling', page: 2 })).toBe(false);
    expect(hasActiveFilters({ sort: 'newest', page: 1, minPrice: 0 })).toBe(true);
    expect(
      hasActiveFilters({ category: 'kaos', sort: 'newest', page: 1 }, { ignoreCategory: true }),
    ).toBe(false);
  });
});
