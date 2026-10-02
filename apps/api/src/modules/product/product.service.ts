import {
  SOLD_STATUSES,
  compareSize,
  type CategorySummary,
  type ProductDetail,
  type ProductImageView,
  type ProductListQuery,
  type ProductListResult,
  type ProductSort,
  type ProductSummary,
} from '@sportswear/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { HttpError } from '../../lib/http-error.js';
import { prisma } from '../../lib/prisma.js';

/**
 * Katalog difilter dan diurutkan di memori: Prisma tidak bisa mengurutkan berdasarkan
 * harga varian termurah. Aman untuk skala PRD (< 500 varian); bila katalog tumbuh
 * jauh di atas itu, pindahkan ke query SQL.
 */
export interface CatalogCandidate {
  id: string;
  createdAt: Date;
  variants: { id: string; price: number; stock: number; isActive: boolean }[];
}

export interface RankedProduct {
  id: string;
  minPrice: number;
  maxPrice: number;
  inStock: boolean;
}

interface RankOptions {
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
  sort: ProductSort;
  /** Unit terjual per varian (untuk sort "bestselling"). */
  soldByVariant?: ReadonlyMap<string, number>;
}

/** Harga dihitung dari varian aktif saja; produk tanpa varian aktif dibuang. */
export function rankProducts(
  candidates: readonly CatalogCandidate[],
  options: RankOptions,
): RankedProduct[] {
  const rows = candidates.flatMap((product) => {
    const active = product.variants.filter((v) => v.isActive);
    if (active.length === 0) return [];
    const prices = active.map((v) => v.price);
    const minPrice = Math.min(...prices);
    const sold = product.variants.reduce(
      (sum, v) => sum + (options.soldByVariant?.get(v.id) ?? 0),
      0,
    );
    return [
      {
        id: product.id,
        createdAt: product.createdAt.getTime(),
        minPrice,
        maxPrice: Math.max(...prices),
        inStock: active.some((v) => v.stock > 0),
        sold,
      },
    ];
  });

  const filtered = rows.filter(
    (row) =>
      (options.minPrice === undefined || row.minPrice >= options.minPrice) &&
      (options.maxPrice === undefined || row.minPrice <= options.maxPrice),
  );

  const newest = (a: (typeof rows)[number], b: (typeof rows)[number]) =>
    b.createdAt - a.createdAt || a.id.localeCompare(b.id);

  filtered.sort((a, b) => {
    // Produk habis selalu di belakang, apa pun urutannya.
    if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
    if (options.sort === 'price_asc') return a.minPrice - b.minPrice || newest(a, b);
    if (options.sort === 'bestselling') return b.sold - a.sold || newest(a, b);
    return newest(a, b);
  });

  return filtered.map(({ id, minPrice, maxPrice, inStock }) => ({
    id,
    minPrice,
    maxPrice,
    inStock,
  }));
}

/** Produk tampil bila aktif dan kategorinya (jika ada) juga aktif. */
const visibleProduct: Prisma.ProductWhereInput = {
  isActive: true,
  OR: [{ categoryId: null }, { category: { isActive: true } }],
};

function catalogWhere(query: ProductListQuery): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [visibleProduct];
  if (query.category) and.push({ category: { slug: query.category, isActive: true } });
  if (query.size) {
    // Filter ukuran hanya menampilkan produk yang ukuran itu masih ada stoknya.
    and.push({ variants: { some: { isActive: true, size: query.size, stock: { gt: 0 } } } });
  }
  if (query.q) and.push({ name: { contains: query.q, mode: 'insensitive' } });
  return { AND: and };
}

async function soldByVariant(): Promise<Map<string, number>> {
  const groups = await prisma.orderItem.groupBy({
    by: ['variantId'],
    where: { variantId: { not: null }, order: { status: { in: [...SOLD_STATUSES] } } },
    _sum: { quantity: true },
  });
  return new Map(
    groups.flatMap((g) => (g.variantId ? [[g.variantId, g._sum.quantity ?? 0] as const] : [])),
  );
}

function toImageView(
  image: { url: string; alt: string | null } | undefined,
  productName: string,
): ProductImageView | null {
  return image ? { url: image.url, alt: image.alt ?? productName } : null;
}

function toCategorySummary(
  category: { id: string; name: string; slug: string } | null,
): CategorySummary | null {
  return category ? { id: category.id, name: category.name, slug: category.slug } : null;
}

export async function listCategories(): Promise<CategorySummary[]> {
  return prisma.category.findMany({
    where: { isActive: true, products: { some: { isActive: true } } },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, slug: true },
  });
}

export async function listProducts(query: ProductListQuery): Promise<ProductListResult> {
  const [candidates, sold] = await Promise.all([
    prisma.product.findMany({
      where: catalogWhere(query),
      select: {
        id: true,
        createdAt: true,
        variants: { select: { id: true, price: true, stock: true, isActive: true } },
      },
    }),
    query.sort === 'bestselling' ? soldByVariant() : Promise.resolve(undefined),
  ]);

  const ranked = rankProducts(candidates, {
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
    sort: query.sort,
    ...(sold && { soldByVariant: sold }),
  });

  const start = (query.page - 1) * query.pageSize;
  const pageRows = ranked.slice(start, start + query.pageSize);

  const details = await prisma.product.findMany({
    where: { id: { in: pageRows.map((r) => r.id) } },
    select: {
      id: true,
      slug: true,
      name: true,
      category: { select: { id: true, name: true, slug: true } },
      images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true, alt: true } },
    },
  });
  const byId = new Map(details.map((d) => [d.id, d]));

  const items: ProductSummary[] = pageRows.flatMap((row) => {
    const detail = byId.get(row.id);
    if (!detail) return [];
    return [
      {
        id: detail.id,
        slug: detail.slug,
        name: detail.name,
        category: toCategorySummary(detail.category),
        image: toImageView(detail.images[0], detail.name),
        minPrice: row.minPrice,
        maxPrice: row.maxPrice,
        inStock: row.inStock,
      },
    ];
  });

  return { items, page: query.page, pageSize: query.pageSize, total: ranked.length };
}

export async function getProductBySlug(slug: string): Promise<ProductDetail> {
  const product = await prisma.product.findFirst({
    where: { AND: [visibleProduct, { slug }] },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      images: { orderBy: { sortOrder: 'asc' } },
      variants: { where: { isActive: true } },
    },
  });
  if (!product || product.variants.length === 0) {
    throw HttpError.notFound('Produk tidak ditemukan');
  }

  const variants = [...product.variants].sort((a, b) => compareSize(a.size, b.size));
  const prices = variants.map((v) => v.price);

  return {
    id: product.id,
    slug: product.slug,
    sku: product.sku,
    name: product.name,
    description: product.description,
    seoTitle: product.seoTitle,
    brand: product.brand,
    gender: product.gender,
    sportType: product.sportType,
    motif: product.motif,
    sleeveLength: product.sleeveLength,
    sizeChartUrl: product.sizeChartUrl,
    category: toCategorySummary(product.category),
    images: product.images.map((image) => ({ url: image.url, alt: image.alt ?? product.name })),
    variants: variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      size: v.size,
      price: v.price,
      stock: v.stock,
      weightGram: v.weightGram,
    })),
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    inStock: variants.some((v) => v.stock > 0),
    updatedAt: product.updatedAt.toISOString(),
  };
}
