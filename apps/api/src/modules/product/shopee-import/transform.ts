/**
 * Mengubah export "Update Massal" Shopee (4 file) menjadi data produk siap import.
 * Murni: tanpa database, jaringan, atau file — semua aturan bisnis import ada di sini.
 */

import { ALL_SIZE, SIZE_ORDER, compareSize } from '@sportswear/shared';

/** Satu baris data Excel, dikunci dengan kode header teknis Shopee (baris 1). */
export type SheetRecord = Record<string, string>;

export interface ShopeeExport {
  basic: SheetRecord[];
  media: SheetRecord[];
  sales: SheetRecord[];
  shipping: SheetRecord[];
}

export interface ImportVariant {
  sku: string;
  size: string;
  price: number;
  stock: number;
  weightGram: number;
}

export interface ImportProduct {
  shopeeItemId: string;
  sku: string;
  name: string;
  slug: string;
  seoTitle: string;
  description: string;
  brand: string;
  category: CategoryRef;
  imageUrls: string[];
  sizeChartUrl: string | null;
  lengthCm: number;
  widthCm: number;
  heightCm: number | null;
  variants: ImportVariant[];
}

export interface SkippedProduct {
  shopeeItemId: string;
  name: string;
  reason: string;
}

export interface TransformResult {
  products: ImportProduct[];
  skipped: SkippedProduct[];
  warnings: string[];
}

export interface CategoryRef {
  name: string;
  slug: string;
}

export const BRAND = '3ON';
export const DEFAULT_WEIGHT_GRAM = 200;
export const DEFAULT_LENGTH_CM = 20;
export const DEFAULT_WIDTH_CM = 10;
export const MAX_IMAGES = 9;
export { ALL_SIZE };

const KAOS: CategoryRef = { name: 'Kaos', slug: 'kaos' };
const CELANA: CategoryRef = { name: 'Celana', slug: 'celana' };
const LEGGING: CategoryRef = { name: 'Legging', slug: 'legging' };
const JAKET: CategoryRef = { name: 'Jaket', slug: 'jaket' };
const POLO: CategoryRef = { name: 'Polo', slug: 'polo' };
const TOPI: CategoryRef = { name: 'Topi', slug: 'topi' };
const TAS: CategoryRef = { name: 'Tas', slug: 'tas' };

/**
 * Awalan kode model SKU → kategori toko. Diutamakan karena kategori di Shopee
 * kadang salah (mis. polo terdaftar sebagai T-shirt).
 */
export const SKU_PREFIX_CATEGORY: Readonly<Record<string, CategoryRef>> = {
  MSL: KAOS,
  TSS: KAOS,
  TLS: KAOS,
  PLS: POLO,
  SHT: CELANA,
  LEG: LEGGING,
  JKT: JAKET,
  FPC: TOPI,
  TBG: TAS,
};

/** Id kategori Shopee → kategori toko; cadangan bila awalan SKU tidak dikenal. */
export const CATEGORY_MAP: Readonly<Record<string, CategoryRef>> = {
  '101311': KAOS,
  '101313': CELANA,
  '100357': LEGGING,
  '101310': JAKET,
  '100354': POLO,
  '101322': TOPI,
  '100093': TAS,
};

// Kolom (kode header teknis) yang dipakai dari tiap file.
const COL = {
  productId: 'et_title_product_id',
  parentSku: 'et_title_parent_sku',
  productName: 'et_title_product_name',
  description: 'et_title_product_description',
  category: 'et_title_product_category',
  coverImage: 'ps_item_cover_image',
  sizeChartTemplate: 'ps_new_size_chart',
  sizeChartImage: 'et_title_size_chart',
  variationId: 'et_title_variation_id',
  variationName: 'et_title_variation_name',
  variationSku: 'et_title_variation_sku',
  price: 'et_title_variation_price',
  stock: 'et_title_variation_stock',
  weight: 'et_title_product_weight',
  length: 'et_title_product_length',
  width: 'et_title_product_width',
  height: 'et_title_product_height',
} as const;

const SKU_PATTERN = /^[A-Z]{2,4}\d{3}-\d+$/;
const SKU_PREFIX = /^([A-Z]{2,4}\d{3}-\d+)/;
const NAME_CODE = /\(([A-Z]{2,4}\d{3}-\d+)\)\s*$/i;

/**
 * Nama tampilan = bagian sebelum " - ", " – ", atau " | " (juga "Haze- Kaos" tanpa spasi
 * sebelum tanda hubung); kode SKU di akhir dibuang. "T-Shirt" tidak ikut terpotong.
 */
export function cleanProductName(raw: string): string {
  const head = raw.split(/\s*[-–]\s+|\s+\|\s+/)[0] ?? raw;
  return head.replace(NAME_CODE, '').trim();
}

/** SKU induk: kolom SKU induk → kode di akhir nama → awalan SKU variasi. */
export function resolveParentSku(
  parentSku: string,
  productName: string,
  variationSkus: string[],
): string | null {
  const direct = parentSku.trim().toUpperCase();
  if (SKU_PATTERN.test(direct)) return direct;

  const fromName = NAME_CODE.exec(productName.trim())?.[1]?.toUpperCase();
  if (fromName) return fromName;

  for (const sku of variationSkus) {
    const prefix = SKU_PREFIX.exec(sku.trim().toUpperCase())?.[1];
    if (prefix) return prefix;
  }
  return null;
}

/** "2XL" → "XXL", kosong → "All Size"; ukuran di luar daftar → null. */
export function normalizeSize(raw: string): string | null {
  const size = raw.trim().toUpperCase();
  if (size === '') return ALL_SIZE;
  if (size === '2XL') return 'XXL';
  return SIZE_ORDER.includes(size) ? size : null;
}

export function isBundle(productName: string, variationNames: string[]): boolean {
  return /bundling/i.test(productName) || variationNames.some((name) => name.includes(','));
}

export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Kategori dari awalan SKU (mis. PLS001-2 → Polo), cadangan: id kategori Shopee. */
export function mapCategory(sku: string, rawCategory: string): CategoryRef | null {
  const prefix = /^([A-Z]+)/.exec(sku)?.[1] ?? '';
  const fromSku = SKU_PREFIX_CATEGORY[prefix];
  if (fromSku) return fromSku;
  const id = rawCategory.split(' - ')[0]?.trim() ?? '';
  return CATEGORY_MAP[id] ?? null;
}

function parseIntStrict(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

class SkipError extends Error {}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return map;
}

export function transformShopeeExport(data: ShopeeExport): TransformResult {
  const get = (row: SheetRecord, col: string) => (row[col] ?? '').trim();
  const mediaById = new Map(data.media.map((row) => [get(row, COL.productId), row]));
  const salesById = groupBy(data.sales, (row) => get(row, COL.productId));
  const shippingByVariation = new Map(
    data.shipping.map((row) => [`${get(row, COL.productId)}:${get(row, COL.variationId)}`, row]),
  );

  const products: ImportProduct[] = [];
  const skipped: SkippedProduct[] = [];
  const warnings: string[] = [];
  const usedSkus = new Set<string>();
  const usedSlugs = new Set<string>();

  for (const basic of data.basic) {
    const shopeeItemId = get(basic, COL.productId);
    const rawName = get(basic, COL.productName);

    try {
      const media = mediaById.get(shopeeItemId);
      const sales = salesById.get(shopeeItemId) ?? [];
      if (!media) throw new SkipError('tidak ada di file media');
      if (sales.length === 0) throw new SkipError('tidak ada di file penjualan');

      const variationNames = sales.map((row) => get(row, COL.variationName));
      if (isBundle(rawName, variationNames)) throw new SkipError('produk bundling (di luar MVP)');

      const sku = resolveParentSku(
        get(basic, COL.parentSku),
        rawName,
        sales.map((row) => get(row, COL.variationSku)),
      );
      if (!sku) throw new SkipError('SKU induk tidak ditemukan');
      if (usedSkus.has(sku)) throw new SkipError(`SKU induk ${sku} dipakai produk lain`);

      const category = mapCategory(sku, get(media, COL.category));
      if (!category) {
        throw new SkipError(`kategori Shopee belum dipetakan: ${get(media, COL.category)}`);
      }

      const name = cleanProductName(rawName);
      if (!name) throw new SkipError('nama produk kosong');

      const variants: ImportVariant[] = [];
      let firstShipping: SheetRecord | undefined;
      for (const row of sales) {
        const size = normalizeSize(get(row, COL.variationName));
        if (!size) throw new SkipError(`ukuran tidak dikenal: "${get(row, COL.variationName)}"`);
        if (variants.some((v) => v.size === size)) {
          throw new SkipError(`ukuran ${size} muncul lebih dari sekali`);
        }

        const price = parseIntStrict(get(row, COL.price));
        if (price === null || price <= 0) throw new SkipError(`harga ukuran ${size} tidak valid`);
        const stock = parseIntStrict(get(row, COL.stock));
        if (stock === null || stock < 0) throw new SkipError(`stok ukuran ${size} tidak valid`);

        const shipping = shippingByVariation.get(`${shopeeItemId}:${get(row, COL.variationId)}`);
        firstShipping ??= shipping;
        let weightGram = shipping ? parseIntStrict(get(shipping, COL.weight)) : null;
        if (weightGram === null || weightGram <= 0) {
          warnings.push(`${sku} ${size}: berat kosong, memakai default ${DEFAULT_WEIGHT_GRAM} g`);
          weightGram = DEFAULT_WEIGHT_GRAM;
        }

        const sizeCode = size === ALL_SIZE ? 'ALL' : size;
        variants.push({ sku: `${sku}-${sizeCode}`, size, price, stock, weightGram });
      }
      variants.sort((a, b) => compareSize(a.size, b.size));

      const imageCols = [
        COL.coverImage,
        ...Array.from({ length: 8 }, (_, i) => `ps_item_image.${i + 1}`),
      ];
      const imageUrls = [...new Set(imageCols.map((col) => get(media, col)).filter(Boolean))].slice(
        0,
        MAX_IMAGES,
      );
      if (imageUrls.length === 0) throw new SkipError('tidak ada foto');

      const sizeChartUrl = get(media, COL.sizeChartImage) || null;
      if (!sizeChartUrl && get(media, COL.sizeChartTemplate)) {
        warnings.push(`${sku}: panduan ukuran berupa template Shopee, tidak bisa diimpor`);
      }

      let slug = slugify(name);
      if (usedSlugs.has(slug)) slug = `${slug}-${sku.toLowerCase()}`;

      usedSkus.add(sku);
      usedSlugs.add(slug);
      products.push({
        shopeeItemId,
        sku,
        name,
        slug,
        seoTitle: rawName,
        description: get(basic, COL.description),
        brand: BRAND,
        category,
        imageUrls,
        sizeChartUrl,
        lengthCm:
          (firstShipping && parseIntStrict(get(firstShipping, COL.length))) || DEFAULT_LENGTH_CM,
        widthCm:
          (firstShipping && parseIntStrict(get(firstShipping, COL.width))) || DEFAULT_WIDTH_CM,
        heightCm: (firstShipping && parseIntStrict(get(firstShipping, COL.height))) || null,
        variants,
      });
    } catch (err) {
      if (!(err instanceof SkipError)) throw err;
      skipped.push({ shopeeItemId, name: rawName, reason: err.message });
    }
  }

  return { products, skipped, warnings };
}
