import { describe, expect, it } from 'vitest';
import { ALL_SIZE, SIZE_ORDER, compareSize } from '../catalog.js';
import { addCartItemSchema, productListQuerySchema, updateCartItemSchema } from './catalog.js';

describe('compareSize', () => {
  it('mengurutkan sesuai SIZE_ORDER', () => {
    const sizes = ['XXL', ALL_SIZE, 'S', 'XL', 'M', 'L'];
    expect([...sizes].sort(compareSize)).toEqual(SIZE_ORDER);
  });

  it('menaruh ukuran tak dikenal di akhir', () => {
    expect(['3XL', 'M'].sort(compareSize)).toEqual(['M', '3XL']);
  });
});

describe('productListQuerySchema', () => {
  it('memberi default sort, page, dan pageSize', () => {
    expect(productListQuerySchema.parse({})).toEqual({ sort: 'newest', page: 1, pageSize: 20 });
  });

  it('mengabaikan parameter kosong dari form filter', () => {
    const query = productListQuerySchema.parse({ category: '', q: '  ', minPrice: '', size: '' });
    expect(query).toEqual({ sort: 'newest', page: 1, pageSize: 20 });
  });

  it('mengubah harga dari query string menjadi integer', () => {
    const query = productListQuerySchema.parse({ minPrice: '50000', maxPrice: '200000' });
    expect(query.minPrice).toBe(50000);
    expect(query.maxPrice).toBe(200000);
  });

  it('menolak harga minimum di atas maksimum', () => {
    const result = productListQuerySchema.safeParse({ minPrice: '300000', maxPrice: '100000' });
    expect(result.success).toBe(false);
  });

  it('menolak urutan yang tidak dikenal dan pageSize di atas batas', () => {
    expect(productListQuerySchema.safeParse({ sort: 'random' }).success).toBe(false);
    expect(productListQuerySchema.safeParse({ pageSize: '500' }).success).toBe(false);
  });
});

describe('skema keranjang', () => {
  it('default jumlah 1 saat menambah item', () => {
    expect(addCartItemSchema.parse({ variantId: 'v1' })).toEqual({ variantId: 'v1', quantity: 1 });
  });

  it('menolak jumlah 0, pecahan, dan di atas batas per item', () => {
    expect(updateCartItemSchema.safeParse({ quantity: 0 }).success).toBe(false);
    expect(updateCartItemSchema.safeParse({ quantity: 1.5 }).success).toBe(false);
    expect(updateCartItemSchema.safeParse({ quantity: 100 }).success).toBe(false);
  });
});
