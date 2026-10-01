import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CatalogView } from '@/components/catalog/catalog-view';
import { fetchCategories, fetchProducts } from '@/lib/api';
import { parseCatalogParams, type SearchParams } from '@/lib/catalog-params';

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}

async function findCategory(slug: string) {
  const categories = await fetchCategories();
  return { categories, category: categories.find((c) => c.slug === slug) };
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { category } = await findCategory(slug);
  // Dipanggil di sini juga: metadata diselesaikan sebelum streaming untuk crawler, jadi status 404.
  if (!category) notFound();
  return {
    title: category.name,
    description: `Belanja ${category.name.toLowerCase()} 3ON dengan pilihan ukuran S sampai XXL.`,
    alternates: { canonical: `/kategori/${category.slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { slug } = await params;
  const { categories, category } = await findCategory(slug);
  if (!category) notFound();

  const { filters, priceError } = parseCatalogParams(await searchParams);
  const scoped = { ...filters, category: category.slug };
  const result = await fetchProducts(scoped);

  return (
    <CatalogView
      title={category.name}
      basePath={`/kategori/${category.slug}`}
      filters={scoped}
      priceError={priceError}
      categories={categories}
      activeCategory={category}
      result={result}
    />
  );
}
