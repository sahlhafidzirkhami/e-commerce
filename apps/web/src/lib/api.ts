// Hanya untuk Server Component: memanggil API langsung lewat API_URL, bukan lewat rewrite /api.
import type {
  ApiError,
  CategorySummary,
  ProductDetail,
  ProductListQuery,
  ProductListResult,
} from '@sportswear/shared';

const apiUrl = process.env.API_URL ?? 'http://localhost:4000';

/** Data katalog boleh basi maksimal 60 detik; stok divalidasi ulang saat masuk keranjang. */
const CATALOG_REVALIDATE_SECONDS = 60;

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${apiUrl}/api${path}`, {
    next: { revalidate: CATALOG_REVALIDATE_SECONDS },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (body as ApiError | null)?.error;
    throw new ApiRequestError(
      res.status,
      error?.code ?? 'INTERNAL_ERROR',
      error?.message ?? 'Gagal memuat data',
    );
  }
  return (body as { data: T }).data;
}

export async function fetchCategories(): Promise<CategorySummary[]> {
  return (await apiGet<{ categories: CategorySummary[] }>('/categories')).categories;
}

export async function fetchProducts(
  query: Partial<ProductListQuery> = {},
): Promise<ProductListResult> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return apiGet<ProductListResult>(`/products${qs ? `?${qs}` : ''}`);
}

/** null bila produk tidak ada atau tidak aktif. */
export async function fetchProduct(slug: string): Promise<ProductDetail | null> {
  try {
    return (await apiGet<{ product: ProductDetail }>(`/products/${encodeURIComponent(slug)}`))
      .product;
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) return null;
    throw err;
  }
}
