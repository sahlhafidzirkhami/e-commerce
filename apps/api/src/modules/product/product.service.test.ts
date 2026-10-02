import { describe, expect, it, vi } from 'vitest';
import { rankProducts, type CatalogCandidate } from './product.service.js';

vi.mock('../../lib/prisma.js', () => ({ prisma: {} }));

function product(
  id: string,
  createdAt: string,
  variants: { price: number; stock: number; isActive?: boolean }[],
): CatalogCandidate {
  return {
    id,
    createdAt: new Date(createdAt),
    variants: variants.map((v, i) => ({
      id: `${id}-v${i}`,
      price: v.price,
      stock: v.stock,
      isActive: v.isActive ?? true,
    })),
  };
}

const kaos = product('kaos', '2026-09-01', [
  { price: 120000, stock: 5 },
  { price: 135000, stock: 0 },
]);
const jaket = product('jaket', '2026-09-03', [{ price: 350000, stock: 2 }]);
const polo = product('polo', '2026-09-02', [
  { price: 150000, stock: 1 },
  { price: 90000, stock: 3, isActive: false },
]);
const topiHabis = product('topi', '2026-09-04', [{ price: 75000, stock: 0 }]);

describe('rankProducts', () => {
  it('menghitung harga dari varian aktif saja', () => {
    const [result] = rankProducts([polo], { sort: 'newest' });
    expect(result).toEqual({ id: 'polo', minPrice: 150000, maxPrice: 150000, inStock: true });
  });

  it('membuang produk tanpa varian aktif', () => {
    const tanpaVarian = product('tas', '2026-09-05', [{ price: 1, stock: 1, isActive: false }]);
    expect(rankProducts([tanpaVarian, kaos], { sort: 'newest' }).map((p) => p.id)).toEqual([
      'kaos',
    ]);
  });

  it('urutan terbaru, produk habis selalu di belakang', () => {
    const ids = rankProducts([kaos, jaket, polo, topiHabis], { sort: 'newest' }).map((p) => p.id);
    expect(ids).toEqual(['jaket', 'polo', 'kaos', 'topi']);
  });

  it('urutan termurah memakai harga varian termurah', () => {
    const ids = rankProducts([kaos, jaket, polo, topiHabis], { sort: 'price_asc' }).map(
      (p) => p.id,
    );
    expect(ids).toEqual(['kaos', 'polo', 'jaket', 'topi']);
  });

  it('urutan terlaris menjumlahkan penjualan semua varian', () => {
    const soldByVariant = new Map([
      ['kaos-v0', 2],
      ['kaos-v1', 5],
      ['polo-v0', 6],
    ]);
    const ids = rankProducts([kaos, jaket, polo], { sort: 'bestselling', soldByVariant }).map(
      (p) => p.id,
    );
    expect(ids).toEqual(['kaos', 'polo', 'jaket']);
  });

  it('penjualan seri diurutkan dari yang terbaru', () => {
    const soldByVariant = new Map([
      ['kaos-v0', 3],
      ['polo-v0', 3],
    ]);
    const ids = rankProducts([kaos, polo], { sort: 'bestselling', soldByVariant }).map((p) => p.id);
    expect(ids).toEqual(['polo', 'kaos']);
  });

  it('filter harga berdasarkan harga termurah, batas inklusif', () => {
    const ids = rankProducts([kaos, jaket, polo], {
      sort: 'price_asc',
      minPrice: 120000,
      maxPrice: 150000,
    }).map((p) => p.id);
    expect(ids).toEqual(['kaos', 'polo']);
  });
});
