import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CatalogView } from '@/components/catalog/catalog-view';
import { fetchCategories, fetchProducts } from '@/lib/api';
import { catalogHref, parseCatalogParams, type SearchParams } from '@/lib/catalog-params';

export const metadata: Metadata = {
  title: 'Semua Produk',
  description: 'Katalog sportswear 3ON: kaos, polo, celana, legging, jaket, topi, dan tas.',
  alternates: { canonical: '/produk' },
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { filters, priceError } = parseCatalogParams(await searchParams);
  // Satu URL per kategori (SEO): /produk?kategori=x dialihkan ke /kategori/x.
  if (filters.category) {
    redirect(
      catalogHref(
        `/kategori/${encodeURIComponent(filters.category)}`,
        filters,
        { page: filters.page },
        {
          includeCategory: false,
        },
      ),
    );
  }
  const [categories, result] = await Promise.all([fetchCategories(), fetchProducts(filters)]);

  return (
    <CatalogView
      title={filters.q ? `Hasil pencarian "${filters.q}"` : 'Semua Produk'}
      basePath="/produk"
      filters={filters}
      priceError={priceError}
      categories={categories}
      result={result}
    />
  );
}
