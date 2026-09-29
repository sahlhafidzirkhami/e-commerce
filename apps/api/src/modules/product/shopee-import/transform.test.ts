import { describe, expect, it } from 'vitest';
import {
  cleanProductName,
  isBundle,
  mapCategory,
  normalizeSize,
  resolveParentSku,
  slugify,
  transformShopeeExport,
  type ShopeeExport,
  type SheetRecord,
} from './transform.js';

describe('cleanProductName', () => {
  it('mengambil bagian sebelum " - "', () => {
    expect(
      cleanProductName(
        '3ON Lumina Women Sleeveless Muscle Tee Sky Blue - Kaos Tanpa lengan Olahraga Wanita (MSL001-3)',
      ),
    ).toBe('3ON Lumina Women Sleeveless Muscle Tee Sky Blue');
  });

  it('mengenali en dash dan garis tegak', () => {
    expect(cleanProductName('3ON Women Flow Short Black – Celana Pendek')).toBe(
      '3ON Women Flow Short Black',
    );
    expect(cleanProductName('3ON Velora Tote Bag | Women Active Canvas Tote')).toBe(
      '3ON Velora Tote Bag',
    );
  });

  it('mempertahankan warna dalam kurung dan membuang kode SKU', () => {
    expect(cleanProductName('3ON Mova Legging Blush Motion (Pink) - Celana')).toBe(
      '3ON Mova Legging Blush Motion (Pink)',
    );
    expect(cleanProductName('3ON Lumina Cap Ivory (FPC001-2)')).toBe('3ON Lumina Cap Ivory');
  });

  it('memotong "Haze- Kaos" tanpa spasi sebelum tanda hubung, tapi tidak "T-Shirt"', () => {
    expect(
      cleanProductName('3ON Lumina Muscle Tee Violet Haze- Kaos Tanpa lengan Olahraga Wanita'),
    ).toBe('3ON Lumina Muscle Tee Violet Haze');
    expect(cleanProductName('3ON Women Oxella Short Sleeve T-Shirt Midnight Onyx (Black)')).toBe(
      '3ON Women Oxella Short Sleeve T-Shirt Midnight Onyx (Black)',
    );
  });
});

describe('resolveParentSku', () => {
  it('memakai kolom SKU induk bila valid', () => {
    expect(resolveParentSku('fpc001-2', 'Nama (XYZ001-1)', [])).toBe('FPC001-2');
  });

  it('lalu kode di akhir nama', () => {
    expect(resolveParentSku('', '3ON Short Sea Moss - Celana (SHT002-2)', [])).toBe('SHT002-2');
  });

  it('lalu awalan SKU variasi', () => {
    expect(resolveParentSku('', '3ON Tee', ['', 'TLS002-3-L'])).toBe('TLS002-3');
  });

  it('null bila tidak ada sumber', () => {
    expect(resolveParentSku('', '3ON Tee', ['', ''])).toBeNull();
  });
});

describe('normalizeSize', () => {
  it.each([
    ['s', 'S'],
    [' XL ', 'XL'],
    ['2XL', 'XXL'],
    ['xxl', 'XXL'],
    ['', 'All Size'],
  ])('%j → %s', (raw, expected) => {
    expect(normalizeSize(raw)).toBe(expected);
  });

  it('menolak ukuran di luar daftar', () => {
    expect(normalizeSize('Black M')).toBeNull();
  });
});

describe('isBundle', () => {
  it('dari nama atau variasi berkoma', () => {
    expect(isBundle('Bundling 3ON Mova Legging', ['S'])).toBe(true);
    expect(isBundle('3ON Set', ['Black S,M'])).toBe(true);
    expect(isBundle('3ON Legging', ['S', 'M'])).toBe(false);
  });
});

describe('mapCategory & slugify', () => {
  const tshirt = '101311 - Sports & Outdoors/Sports & Outdoor Apparels/T-shirts';

  it('mengutamakan awalan SKU (polo yang di Shopee terdaftar sebagai T-shirt)', () => {
    expect(mapCategory('PLS001-2', tshirt)).toEqual({ name: 'Polo', slug: 'polo' });
    expect(mapCategory('TLS002-3', tshirt)).toEqual({ name: 'Kaos', slug: 'kaos' });
  });

  it('memakai id kategori Shopee bila awalan SKU tidak dikenal', () => {
    expect(mapCategory('XYZ001-1', tshirt)).toEqual({ name: 'Kaos', slug: 'kaos' });
    expect(mapCategory('XYZ001-1', '999999 - Lainnya')).toBeNull();
  });

  it('slug huruf kecil dengan tanda hubung', () => {
    expect(slugify('3ON Mova Legging Blush Motion (Pink)')).toBe(
      '3on-mova-legging-blush-motion-pink',
    );
  });
});

// ─── transformShopeeExport ──────────────────────────────────────────────────

function product(
  id: string,
  name: string,
  overrides: Partial<Record<keyof ShopeeExport, SheetRecord>> = {},
) {
  return {
    basic: {
      et_title_product_id: id,
      et_title_parent_sku: '',
      et_title_product_name: name,
      et_title_product_description: 'Deskripsi',
      ...overrides.basic,
    },
    media: {
      et_title_product_id: id,
      et_title_product_category: '101311 - Sports & Outdoors/Sports & Outdoor Apparels/T-shirts',
      ps_item_cover_image: `https://cf.shopee.co.id/file/${id}-cover`,
      'ps_item_image.1': `https://cf.shopee.co.id/file/${id}-1`,
      et_title_size_chart: '',
      ps_new_size_chart: '',
      ...overrides.media,
    },
  };
}

function variant(id: string, variationId: string, size: string, extra: SheetRecord = {}) {
  return {
    sales: {
      et_title_product_id: id,
      et_title_variation_id: variationId,
      et_title_variation_name: size,
      et_title_variation_sku: '',
      et_title_variation_price: '239900',
      et_title_variation_stock: '5',
      ...extra,
    },
    shipping: {
      et_title_product_id: id,
      et_title_variation_id: variationId,
      et_title_product_weight: '200',
      et_title_product_length: '20',
      et_title_product_width: '10',
      et_title_product_height: '3',
    },
  };
}

function build(
  products: ReturnType<typeof product>[],
  variants: ReturnType<typeof variant>[],
): ShopeeExport {
  return {
    basic: products.map((p) => p.basic),
    media: products.map((p) => p.media),
    sales: variants.map((v) => v.sales),
    shipping: variants.map((v) => v.shipping),
  };
}

describe('transformShopeeExport', () => {
  it('menghasilkan produk dengan varian terurut dan SKU varian', () => {
    const result = transformShopeeExport(
      build(
        [product('1', '3ON Muscle Tee Sky Blue - Kaos Wanita (MSL001-3)')],
        [variant('1', 'a', 'XL'), variant('1', 'b', 'S'), variant('1', 'c', '2XL')],
      ),
    );

    expect(result.skipped).toEqual([]);
    const [p] = result.products;
    expect(p).toMatchObject({
      shopeeItemId: '1',
      sku: 'MSL001-3',
      name: '3ON Muscle Tee Sky Blue',
      slug: '3on-muscle-tee-sky-blue',
      brand: '3ON',
      category: { slug: 'kaos' },
      lengthCm: 20,
      widthCm: 10,
      heightCm: 3,
    });
    expect(p?.variants.map((v) => v.sku)).toEqual(['MSL001-3-S', 'MSL001-3-XL', 'MSL001-3-XXL']);
    expect(p?.variants[0]).toMatchObject({ price: 239900, stock: 5, weightGram: 200 });
  });

  it('produk tanpa variasi menjadi satu varian All Size', () => {
    const result = transformShopeeExport(
      build([product('2', '3ON Cap Ivory (FPC001-2)')], [variant('2', '', '')]),
    );
    expect(result.products[0]?.variants).toEqual([
      { sku: 'FPC001-2-ALL', size: 'All Size', price: 239900, stock: 5, weightGram: 200 },
    ]);
  });

  it('melewati bundling, SKU tidak ditemukan, dan harga tidak valid', () => {
    const result = transformShopeeExport(
      build(
        [
          product('3', 'Bundling 3ON Mova Legging With Short Sleeve'),
          product('4', '3ON Tee Tanpa Kode'),
          product('5', '3ON Tee Harga Rusak (TSS001-9)'),
        ],
        [
          variant('3', 'x', 'Black S,M'),
          variant('4', 'y', 'S'),
          variant('5', 'z', 'S', { et_title_variation_price: '1500.5' }),
        ],
      ),
    );

    expect(result.products).toEqual([]);
    expect(result.skipped.map((s) => [s.shopeeItemId, s.reason])).toEqual([
      ['3', 'produk bundling (di luar MVP)'],
      ['4', 'SKU induk tidak ditemukan'],
      ['5', 'harga ukuran S tidak valid'],
    ]);
  });

  it('memberi peringatan untuk panduan ukuran berupa template Shopee', () => {
    const result = transformShopeeExport(
      build(
        [
          product('6', '3ON Short (SHT002-2)', {
            media: { ps_new_size_chart: '1804899261' } as SheetRecord,
          }),
        ],
        [variant('6', 'a', 'S')],
      ),
    );
    expect(result.products[0]?.sizeChartUrl).toBeNull();
    expect(result.warnings).toContain(
      'SHT002-2: panduan ukuran berupa template Shopee, tidak bisa diimpor',
    );
  });

  it('memakai berat default bila kosong', () => {
    const data = build([product('7', '3ON Tee (TSS001-1)')], [variant('7', 'a', 'M')]);
    const shippingRow = data.shipping[0];
    if (shippingRow) shippingRow.et_title_product_weight = '';
    const result = transformShopeeExport(data);
    expect(result.products[0]?.variants[0]?.weightGram).toBe(200);
    expect(result.warnings).toContain('TSS001-1 M: berat kosong, memakai default 200 g');
  });
});
