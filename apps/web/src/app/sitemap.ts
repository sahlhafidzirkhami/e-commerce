import { PAGINATION } from '@sportswear/shared';
import type { MetadataRoute } from 'next';
import { connection } from 'next/server';
import { fetchCategories, fetchProducts } from '@/lib/api';
import { siteUrl } from '@/lib/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Dirender per request agar `next build` tidak butuh API.
  await connection();
  const categories = await fetchCategories();

  const products = [];
  for (let page = 1; ; page++) {
    const result = await fetchProducts({ page, pageSize: PAGINATION.MAX_PAGE_SIZE });
    products.push(...result.items);
    if (page * result.pageSize >= result.total) break;
  }

  return [
    { url: siteUrl, changeFrequency: 'daily', priority: 1 },
    { url: `${siteUrl}/produk`, changeFrequency: 'daily', priority: 0.9 },
    ...categories.map((category) => ({
      url: `${siteUrl}/kategori/${category.slug}`,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
    ...products.map((product) => ({
      url: `${siteUrl}/produk/${product.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];
}
