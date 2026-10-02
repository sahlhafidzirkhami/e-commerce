import { randomBytes } from 'node:crypto';
import {
  ALL_SIZE,
  ErrorCode,
  PAGINATION,
  compareSize,
  type AdminCategory,
  type AdminProductDetail,
  type AdminProductListResult,
  type CategoryInput,
  type ProductCreateInput,
  type ProductUpdateInput,
  type StockUpdateInput,
  type VariantCreateInput,
  type VariantUpdateInput,
} from '@sportswear/shared';
import { Prisma } from '../../generated/prisma/client.js';
import { HttpError } from '../../lib/http-error.js';
import { prisma } from '../../lib/prisma.js';
import { storage } from '../../lib/storage.js';
import { toWebp } from './shopee-import/images.js';
import { slugify } from './shopee-import/transform.js';

const MAX_IMAGES = 9;

function isUnique(err: unknown, field: string): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002' &&
    JSON.stringify(err.meta ?? {}).includes(field)
  );
}

/** SKU ukuran = SKU induk + kode ukuran, sama seperti importer Shopee. */
export function variantSku(productSku: string, size: string): string {
  return `${productSku}-${size === ALL_SIZE ? 'ALL' : size}`;
}

// ─── Daftar & detail ────────────────────────────────────────────────────────

export interface AdminProductListQuery {
  q?: string | undefined;
  categoryId?: string | undefined;
  status?: 'active' | 'inactive' | undefined;
  page: number;
}

export async function listAdminProducts(
  query: AdminProductListQuery,
): Promise<AdminProductListResult> {
  const pageSize = PAGINATION.DEFAULT_PAGE_SIZE;
  const where: Prisma.ProductWhereInput = {
    ...(query.status && { isActive: query.status === 'active' }),
    ...(query.categoryId && { categoryId: query.categoryId }),
    ...(query.q && {
      OR: [
        { name: { contains: query.q, mode: 'insensitive' } },
        { sku: { contains: query.q, mode: 'insensitive' } },
      ],
    }),
  };
  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * pageSize,
      take: pageSize,
      include: {
        category: { select: { id: true, name: true } },
        images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true } },
        variants: { select: { size: true, stock: true, price: true, isActive: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items: products.map((p) => {
      const active = p.variants.filter((v) => v.isActive);
      const prices = active.map((v) => v.price);
      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        slug: p.slug,
        isActive: p.isActive,
        category: p.category,
        imageUrl: p.images[0]?.url ?? null,
        minPrice: prices.length ? Math.min(...prices) : null,
        maxPrice: prices.length ? Math.max(...prices) : null,
        totalStock: active.reduce((sum, v) => sum + v.stock, 0),
        variants: [...p.variants]
          .sort((a, b) => compareSize(a.size, b.size))
          .map((v) => ({ size: v.size, stock: v.stock, isActive: v.isActive })),
      };
    }),
    page: query.page,
    pageSize,
    total,
  };
}

export async function getAdminProduct(id: string): Promise<AdminProductDetail> {
  const p = await prisma.product.findUnique({
    where: { id },
    include: { images: { orderBy: { sortOrder: 'asc' } }, variants: true },
  });
  if (!p) throw HttpError.notFound('Produk tidak ditemukan');
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    slug: p.slug,
    categoryId: p.categoryId,
    description: p.description,
    seoTitle: p.seoTitle,
    brand: p.brand,
    gender: p.gender,
    sportType: p.sportType,
    motif: p.motif,
    sleeveLength: p.sleeveLength,
    lengthCm: p.lengthCm,
    widthCm: p.widthCm,
    heightCm: p.heightCm,
    isActive: p.isActive,
    sizeChartUrl: p.sizeChartUrl,
    images: p.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt })),
    variants: [...p.variants]
      .sort((a, b) => compareSize(a.size, b.size))
      .map((v) => ({
        id: v.id,
        sku: v.sku,
        size: v.size,
        price: v.price,
        stock: v.stock,
        weightGram: v.weightGram,
        isActive: v.isActive,
      })),
  };
}

// ─── Buat & ubah produk ─────────────────────────────────────────────────────

async function assertCategory(categoryId: string | null): Promise<void> {
  if (!categoryId) return;
  const found = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });
  if (!found) throw HttpError.badRequest('Kategori tidak ditemukan');
}

export async function createProduct(input: ProductCreateInput): Promise<AdminProductDetail> {
  await assertCategory(input.categoryId);
  const { variants, slug, ...fields } = input;
  const baseSlug = slug ?? slugify(input.name);
  try {
    const product = await prisma.product.create({
      data: {
        ...fields,
        slug: baseSlug,
        variants: {
          create: variants.map((v) => ({ ...v, sku: variantSku(input.sku, v.size) })),
        },
      },
      select: { id: true },
    });
    return getAdminProduct(product.id);
  } catch (err) {
    if (isUnique(err, 'sku'))
      throw HttpError.conflict(`SKU ${input.sku} sudah dipakai produk lain`);
    if (isUnique(err, 'slug')) {
      throw HttpError.conflict(`Slug "${baseSlug}" sudah dipakai produk lain. Isi slug lain.`);
    }
    throw err;
  }
}

/** Slug hanya berubah bila admin mengubahnya sendiri, agar URL yang terindeks tidak putus. */
export async function updateProduct(
  id: string,
  input: ProductUpdateInput,
): Promise<AdminProductDetail> {
  await assertCategory(input.categoryId);
  try {
    await prisma.product.update({ where: { id }, data: input });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw HttpError.notFound('Produk tidak ditemukan');
    }
    if (isUnique(err, 'slug')) throw HttpError.conflict(`Slug "${input.slug}" sudah dipakai`);
    throw err;
  }
  return getAdminProduct(id);
}

// ─── Ukuran & stok ──────────────────────────────────────────────────────────

export async function addVariant(
  productId: string,
  input: VariantCreateInput,
): Promise<AdminProductDetail> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { sku: true },
  });
  if (!product) throw HttpError.notFound('Produk tidak ditemukan');
  try {
    await prisma.productVariant.create({
      data: { ...input, productId, sku: variantSku(product.sku, input.size) },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw HttpError.conflict(`Ukuran ${input.size} sudah ada di produk ini`);
    }
    throw err;
  }
  return getAdminProduct(productId);
}

async function variantProductId(variantId: string): Promise<string> {
  const v = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { productId: true },
  });
  if (!v) throw HttpError.notFound('Ukuran tidak ditemukan');
  return v.productId;
}

/** Harga baru hanya berlaku untuk pesanan berikutnya (OrderItem menyimpan snapshot harga). */
export async function updateVariant(
  variantId: string,
  input: VariantUpdateInput,
): Promise<AdminProductDetail> {
  const productId = await variantProductId(variantId);
  await prisma.productVariant.update({ where: { id: variantId }, data: input });
  return getAdminProduct(productId);
}

/**
 * Set stok bersyarat: hanya berhasil bila stok di database masih sama dengan yang dilihat
 * admin. Mencegah angka admin menimpa pengurangan stok dari checkout yang terjadi bersamaan.
 */
export async function setVariantStock(
  variantId: string,
  input: StockUpdateInput,
): Promise<AdminProductDetail> {
  const productId = await variantProductId(variantId);
  const { count } = await prisma.productVariant.updateMany({
    where: { id: variantId, stock: input.expected },
    data: { stock: input.stock },
  });
  if (count === 0) {
    const current = await prisma.productVariant.findUniqueOrThrow({
      where: { id: variantId },
      select: { stock: true },
    });
    throw HttpError.conflict(
      `Stok baru saja berubah menjadi ${current.stock} (ada pesanan masuk). Periksa lalu simpan lagi.`,
      ErrorCode.STOCK_CHANGED,
    );
  }
  return getAdminProduct(productId);
}

// ─── Foto ───────────────────────────────────────────────────────────────────

function imageKey(productSku: string): string {
  return `products/${productSku}/${randomBytes(6).toString('hex')}.webp`;
}

async function toWebpOrReject(data: Buffer) {
  try {
    return await toWebp(data);
  } catch {
    throw HttpError.badRequest('File bukan gambar yang bisa dibaca (JPG, PNG, atau WebP)');
  }
}

/** Satu foto per request (body biner); unggah massal = beberapa request berurutan. */
export async function addProductImage(
  productId: string,
  data: Buffer,
): Promise<AdminProductDetail> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { sku: true, name: true, _count: { select: { images: true } } },
  });
  if (!product) throw HttpError.notFound('Produk tidak ditemukan');
  if (product._count.images >= MAX_IMAGES) {
    throw HttpError.badRequest(`Maksimal ${MAX_IMAGES} foto per produk`);
  }

  const image = await toWebpOrReject(data);
  const url = await storage.put(imageKey(product.sku), image.data, 'image/webp');
  const last = await prisma.productImage.aggregate({
    where: { productId },
    _max: { sortOrder: true },
  });
  await prisma.productImage.create({
    data: { productId, url, alt: product.name, sortOrder: (last._max.sortOrder ?? -1) + 1 },
  });
  return getAdminProduct(productId);
}

export async function deleteProductImage(imageId: string): Promise<AdminProductDetail> {
  const image = await prisma.productImage.findUnique({ where: { id: imageId } });
  if (!image) throw HttpError.notFound('Foto tidak ditemukan');
  await prisma.productImage.delete({ where: { id: imageId } });
  await storage.remove(image.url);
  return getAdminProduct(image.productId);
}

/** Urutan foto; foto pertama = cover di katalog. */
export async function reorderProductImages(
  productId: string,
  imageIds: string[],
): Promise<AdminProductDetail> {
  const existing = await prisma.productImage.findMany({
    where: { productId },
    select: { id: true },
  });
  const ids = new Set(existing.map((i) => i.id));
  if (imageIds.length !== ids.size || imageIds.some((id) => !ids.has(id))) {
    throw HttpError.badRequest('Daftar foto tidak sesuai dengan foto produk ini');
  }
  await prisma.$transaction(
    imageIds.map((id, index) =>
      prisma.productImage.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );
  return getAdminProduct(productId);
}

export async function setSizeChart(productId: string, data: Buffer): Promise<AdminProductDetail> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { sku: true, sizeChartUrl: true },
  });
  if (!product) throw HttpError.notFound('Produk tidak ditemukan');
  const image = await toWebpOrReject(data);
  const url = await storage.put(imageKey(product.sku), image.data, 'image/webp');
  await prisma.product.update({ where: { id: productId }, data: { sizeChartUrl: url } });
  if (product.sizeChartUrl) await storage.remove(product.sizeChartUrl);
  return getAdminProduct(productId);
}

// ─── Kategori ───────────────────────────────────────────────────────────────

export async function listAdminCategories(): Promise<AdminCategory[]> {
  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { products: true } } },
  });
  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    isActive: c.isActive,
    sortOrder: c.sortOrder,
    productCount: c._count.products,
  }));
}

export async function createCategory(input: CategoryInput): Promise<AdminCategory[]> {
  try {
    await prisma.category.create({ data: { ...input, slug: slugify(input.name) } });
  } catch (err) {
    if (isUnique(err, 'slug')) throw HttpError.conflict(`Kategori "${input.name}" sudah ada`);
    throw err;
  }
  return listAdminCategories();
}

/** Slug kategori tetap walau nama diubah, agar URL /kategori/<slug> tidak putus. */
export async function updateCategory(id: string, input: CategoryInput): Promise<AdminCategory[]> {
  const { count } = await prisma.category.updateMany({ where: { id }, data: input });
  if (count === 0) throw HttpError.notFound('Kategori tidak ditemukan');
  return listAdminCategories();
}
