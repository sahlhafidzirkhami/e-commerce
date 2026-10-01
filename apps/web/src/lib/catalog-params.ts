import { productListQuerySchema, type ProductListQuery } from '@sportswear/shared';

export type SearchParams = Record<string, string | string[] | undefined>;

/** Filter katalog yang bisa diatur lewat URL (kategori diatur oleh path di /kategori). */
export interface CatalogFilters {
  category?: string | undefined;
  size?: string | undefined;
  q?: string | undefined;
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
  sort: ProductListQuery['sort'];
  page: number;
}

export interface ParsedCatalogParams {
  filters: CatalogFilters;
  /** Pesan bila rentang harga di URL tidak valid; filter harga diabaikan. */
  priceError: string | null;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseCatalogParams(searchParams: SearchParams): ParsedCatalogParams {
  const raw = {
    category: first(searchParams.kategori),
    size: first(searchParams.ukuran),
    q: first(searchParams.q),
    minPrice: first(searchParams.min),
    maxPrice: first(searchParams.max),
    sort: first(searchParams.urut),
    page: first(searchParams.halaman),
  };

  const parsed = productListQuerySchema.safeParse(raw);
  if (parsed.success) {
    const { pageSize: _pageSize, ...filters } = parsed.data;
    return { filters, priceError: null };
  }

  // Coba lagi tanpa harga; parameter lain yang tidak valid jatuh ke default.
  const withoutPrice = productListQuerySchema.safeParse({
    ...raw,
    minPrice: undefined,
    maxPrice: undefined,
  });
  const fallback = withoutPrice.success
    ? withoutPrice.data
    : productListQuerySchema.parse({ category: raw.category });
  const { pageSize: _pageSize, ...filters } = fallback;
  return {
    filters,
    priceError: withoutPrice.success ? 'Rentang harga tidak valid, filter harga diabaikan.' : null,
  };
}

/**
 * URL katalog dengan filter yang diubah. Setiap perubahan filter kembali ke halaman 1,
 * kecuali yang diubah memang halamannya.
 */
export function catalogHref(
  basePath: string,
  current: CatalogFilters,
  changes: Partial<CatalogFilters>,
  { includeCategory = true }: { includeCategory?: boolean } = {},
): string {
  const next: CatalogFilters = {
    ...current,
    page: 1,
    ...changes,
  };
  const params = new URLSearchParams();
  if (includeCategory && next.category) params.set('kategori', next.category);
  if (next.size) params.set('ukuran', next.size);
  if (next.q) params.set('q', next.q);
  if (next.minPrice !== undefined) params.set('min', String(next.minPrice));
  if (next.maxPrice !== undefined) params.set('max', String(next.maxPrice));
  if (next.sort !== 'newest') params.set('urut', next.sort);
  if (next.page > 1) params.set('halaman', String(next.page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** true bila ada filter selain urutan dan halaman. */
export function hasActiveFilters(filters: CatalogFilters, { ignoreCategory = false } = {}) {
  return Boolean(
    (!ignoreCategory && filters.category) ||
    filters.size ||
    filters.q ||
    filters.minPrice !== undefined ||
    filters.maxPrice !== undefined,
  );
}
