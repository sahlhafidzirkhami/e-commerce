/** Ukuran untuk produk tanpa variasi ukuran (topi, tas). */
export const ALL_SIZE = 'All Size';

/** Urutan tampil ukuran, dari kecil ke besar. */
export const SIZE_ORDER: readonly string[] = ['S', 'M', 'L', 'XL', 'XXL', ALL_SIZE];

/** Urutkan varian berdasarkan SIZE_ORDER; ukuran di luar daftar ditaruh di akhir. */
export function compareSize(a: string, b: string): number {
  const rank = (size: string) => {
    const index = SIZE_ORDER.indexOf(size);
    return index === -1 ? SIZE_ORDER.length : index;
  };
  return rank(a) - rank(b);
}

export const PRODUCT_SORTS = ['newest', 'price_asc', 'bestselling'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export const PRODUCT_SORT_LABELS: Readonly<Record<ProductSort, string>> = {
  newest: 'Terbaru',
  price_asc: 'Termurah',
  bestselling: 'Terlaris',
};

/** Batas jumlah satu varian per keranjang, di luar batas stok. */
export const CART_MAX_QUANTITY_PER_ITEM = 99;

export interface CategorySummary {
  id: string;
  name: string;
  slug: string;
}

export interface ProductImageView {
  url: string;
  alt: string;
}

/** Produk di grid katalog. */
export interface ProductSummary {
  id: string;
  slug: string;
  name: string;
  category: CategorySummary | null;
  image: ProductImageView | null;
  /** Harga varian aktif termurah dan termahal (Rupiah). */
  minPrice: number;
  maxPrice: number;
  /** false bila semua ukuran stoknya 0. */
  inStock: boolean;
}

export interface ProductVariantView {
  id: string;
  sku: string;
  size: string;
  price: number;
  stock: number;
  weightGram: number;
}

export interface ProductDetail extends Omit<ProductSummary, 'image'> {
  sku: string;
  description: string;
  seoTitle: string | null;
  brand: string | null;
  gender: string | null;
  sportType: string | null;
  motif: string | null;
  sleeveLength: string | null;
  sizeChartUrl: string | null;
  images: ProductImageView[];
  /** Semua varian aktif, termasuk yang stoknya 0 (ditampilkan tapi tidak bisa dipilih). */
  variants: ProductVariantView[];
  updatedAt: string;
}

export interface ProductListResult {
  items: ProductSummary[];
  page: number;
  pageSize: number;
  total: number;
}

export const CART_ITEM_ISSUES = ['UNAVAILABLE', 'OUT_OF_STOCK', 'INSUFFICIENT_STOCK'] as const;
export type CartItemIssue = (typeof CART_ITEM_ISSUES)[number];

export interface CartItemView {
  variantId: string;
  productSlug: string;
  productName: string;
  size: string;
  sku: string;
  image: ProductImageView | null;
  /** Harga saat ini dari database, bukan harga saat ditambahkan. */
  price: number;
  quantity: number;
  /** Stok tersedia saat ini; 0 bila varian/produk nonaktif. */
  stock: number;
  lineTotal: number;
  issue: CartItemIssue | null;
}

export interface CartView {
  items: CartItemView[];
  /** Jumlah unit seluruh item. */
  itemCount: number;
  /** Total item yang bisa dibeli (item bermasalah tidak dihitung). */
  subtotal: number;
  /** true bila ada item bermasalah; checkout harus diblokir sampai diperbaiki. */
  hasIssues: boolean;
}
