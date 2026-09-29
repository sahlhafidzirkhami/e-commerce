import { prisma } from '../../../lib/prisma.js';
import type { StorageDriver } from '../../../lib/storage.js';
import { downloadImage, isSquare, toWebp } from './images.js';
import type { CategoryRef, ImportProduct } from './transform.js';

export interface ImportOptions {
  /** Hanya unduh & validasi foto, tanpa menulis file maupun database. */
  dryRun: boolean;
  /** Timpa stok varian yang sudah ada. Default: stok hanya diisi saat varian dibuat. */
  updateStock: boolean;
  storage: StorageDriver;
  onProgress?: (message: string) => void;
}

export interface ImportReport {
  created: string[];
  updated: string[];
  variantsCreated: number;
  variantsUpdated: number;
  imagesSaved: number;
  warnings: string[];
  failed: { sku: string; reason: string }[];
}

const IMAGE_CONCURRENCY = 4;

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index] as T);
    }
  });
  await Promise.all(workers);
  return results;
}

async function ensureCategory(category: CategoryRef, cache: Map<string, string>): Promise<string> {
  const cached = cache.get(category.slug);
  if (cached) return cached;
  const { id } = await prisma.category.upsert({
    where: { slug: category.slug },
    create: { name: category.name, slug: category.slug },
    update: {},
    select: { id: true },
  });
  cache.set(category.slug, id);
  return id;
}

export async function importProducts(
  products: ImportProduct[],
  options: ImportOptions,
): Promise<ImportReport> {
  const report: ImportReport = {
    created: [],
    updated: [],
    variantsCreated: 0,
    variantsUpdated: 0,
    imagesSaved: 0,
    warnings: [],
    failed: [],
  };
  const categoryIds = new Map<string, string>();

  for (const [index, product] of products.entries()) {
    options.onProgress?.(`[${index + 1}/${products.length}] ${product.sku} ${product.name}`);
    try {
      const images = await mapLimit(product.imageUrls, IMAGE_CONCURRENCY, async (url) =>
        toWebp(await downloadImage(url)),
      );
      const cover = images[0];
      if (cover && !isSquare(cover)) {
        report.warnings.push(
          `${product.sku}: cover bukan 1:1 (${cover.sourceWidth}×${cover.sourceHeight})`,
        );
      }
      const sizeChart = product.sizeChartUrl
        ? await toWebp(await downloadImage(product.sizeChartUrl))
        : null;

      if (options.dryRun) continue;

      const base = `products/${product.sku}`;
      const imageUrls = await Promise.all(
        images.map((image, i) =>
          options.storage.put(
            `${base}/${String(i + 1).padStart(2, '0')}.webp`,
            image.data,
            'image/webp',
          ),
        ),
      );
      const sizeChartUrl = sizeChart
        ? await options.storage.put(`${base}/size-chart.webp`, sizeChart.data, 'image/webp')
        : null;
      report.imagesSaved += imageUrls.length + (sizeChartUrl ? 1 : 0);

      const categoryId = await ensureCategory(product.category, categoryIds);
      const fields = {
        sku: product.sku,
        name: product.name,
        seoTitle: product.seoTitle,
        description: product.description,
        brand: product.brand,
        categoryId,
        sizeChartUrl,
        lengthCm: product.lengthCm,
        widthCm: product.widthCm,
        heightCm: product.heightCm,
      };

      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.product.findUnique({
          where: { shopeeItemId: product.shopeeItemId },
          select: { id: true },
        });

        let productId: string;
        if (existing) {
          // Slug tidak diubah agar URL produk tetap stabil.
          await tx.product.update({ where: { id: existing.id }, data: fields });
          productId = existing.id;
        } else {
          const slugTaken = await tx.product.findUnique({
            where: { slug: product.slug },
            select: { id: true },
          });
          const slug = slugTaken ? `${product.slug}-${product.sku.toLowerCase()}` : product.slug;
          const created = await tx.product.create({
            data: { ...fields, slug, shopeeItemId: product.shopeeItemId },
            select: { id: true },
          });
          productId = created.id;
        }

        let variantsCreated = 0;
        let variantsUpdated = 0;
        for (const variant of product.variants) {
          const current = await tx.productVariant.findUnique({
            where: { sku: variant.sku },
            select: { id: true, productId: true },
          });
          if (current) {
            if (current.productId !== productId) {
              throw new Error(`SKU varian ${variant.sku} sudah dipakai produk lain`);
            }
            await tx.productVariant.update({
              where: { id: current.id },
              data: {
                size: variant.size,
                price: variant.price,
                weightGram: variant.weightGram,
                ...(options.updateStock && { stock: variant.stock }),
              },
            });
            variantsUpdated++;
          } else {
            await tx.productVariant.create({ data: { productId, ...variant } });
            variantsCreated++;
          }
        }

        await tx.productImage.deleteMany({ where: { productId } });
        await tx.productImage.createMany({
          data: imageUrls.map((url, i) => ({ productId, url, alt: product.name, sortOrder: i })),
        });

        return { created: !existing, variantsCreated, variantsUpdated };
      });

      (result.created ? report.created : report.updated).push(product.sku);
      report.variantsCreated += result.variantsCreated;
      report.variantsUpdated += result.variantsUpdated;
    } catch (err) {
      report.failed.push({
        sku: product.sku,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return report;
}
