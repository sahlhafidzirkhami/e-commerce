import { describe, expect, it } from 'vitest';
import { paginationSchema, rupiahSchema } from './common.js';

describe('rupiahSchema', () => {
  it('menerima integer non-negatif', () => {
    expect(rupiahSchema.parse(0)).toBe(0);
    expect(rupiahSchema.parse(150000)).toBe(150000);
  });

  it('menolak desimal dan nilai negatif', () => {
    expect(rupiahSchema.safeParse(1500.5).success).toBe(false);
    expect(rupiahSchema.safeParse(-1).success).toBe(false);
  });
});

describe('paginationSchema', () => {
  it('memakai default saat kosong', () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it('mengubah query string menjadi angka', () => {
    expect(paginationSchema.parse({ page: '3', pageSize: '50' })).toEqual({
      page: 3,
      pageSize: 50,
    });
  });

  it('menolak pageSize di atas batas', () => {
    expect(paginationSchema.safeParse({ pageSize: 1000 }).success).toBe(false);
  });
});
