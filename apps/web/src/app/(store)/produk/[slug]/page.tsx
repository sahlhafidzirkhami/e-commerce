import type { ProductDetail } from '@sportswear/shared';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AddToCart } from '@/components/product/add-to-cart';
import { fetchProduct } from '@/lib/api';
import { formatPriceRange } from '@/lib/format';
import { SITE_NAME, siteUrl } from '@/lib/site';

export const revalidate = 60;

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

/** Ringkasan untuk meta description: paragraf pertama, maks. 155 karakter. */
function summary(description: string): string {
  const firstParagraph =
    description
      .split(/\n\s*\n/)[0]
      ?.replace(/\s+/g, ' ')
      .trim() ?? '';
  return firstParagraph.length > 155
    ? `${firstParagraph.slice(0, 152).trimEnd()}...`
    : firstParagraph;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await fetchProduct(slug);
  // Dipanggil di sini juga: metadata diselesaikan sebelum streaming untuk crawler, jadi status 404.
  if (!product) notFound();
  const description = summary(product.description) || `${product.name} dari ${SITE_NAME}.`;
  return {
    title: product.name,
    description,
    alternates: { canonical: `/produk/${product.slug}` },
    openGraph: {
      title: product.seoTitle ?? product.name,
      description,
      url: `/produk/${product.slug}`,
      images: product.images.slice(0, 1).map((image) => ({ url: image.url, alt: image.alt })),
    },
  };
}

function productJsonLd(product: ProductDetail) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    sku: product.sku,
    description: summary(product.description),
    image: product.images.map((image) => image.url),
    ...(product.brand && { brand: { '@type': 'Brand', name: product.brand } }),
    ...(product.category && { category: product.category.name }),
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'IDR',
      lowPrice: product.minPrice,
      highPrice: product.maxPrice,
      offerCount: product.variants.length,
      availability: product.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: `${siteUrl}/produk/${product.slug}`,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await fetchProduct(slug);
  if (!product) notFound();

  const attributes = [
    ['Merek', product.brand],
    ['Gender', product.gender],
    ['Olahraga', product.sportType],
    ['Motif', product.motif],
    ['Panjang lengan', product.sleeveLength],
    ['Berat per pcs', product.variants[0] ? `${product.variants[0].weightGram} g` : null],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <main className="mx-auto max-w-7xl px-4 pt-4 pb-14 md:px-6 md:pb-20 lg:px-8 lg:pb-28">
      <script
        type="application/ld+json"
        // JSON dari data produk sendiri; "<" di-escape agar tidak bisa menutup tag script.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productJsonLd(product)).replace(/</g, '\\u003c'),
        }}
      />

      <nav aria-label="Lokasi halaman" className="text-sm text-ink-2">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/produk" className="inline-flex min-h-11 items-center hover:underline">
              Produk
            </Link>
          </li>
          {product.category && (
            <>
              <li aria-hidden>/</li>
              <li>
                <Link
                  href={`/kategori/${product.category.slug}`}
                  className="inline-flex min-h-11 items-center hover:underline"
                >
                  {product.category.name}
                </Link>
              </li>
            </>
          )}
        </ol>
      </nav>

      <div className="mt-2 grid gap-8 md:grid-cols-2 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12">
        <section aria-label="Foto produk">
          {product.images.length === 0 ? (
            <div className="flex aspect-square items-center justify-center rounded-2xl bg-muted text-sm text-ink-2">
              Foto belum tersedia
            </div>
          ) : (
            <ul
              tabIndex={0}
              aria-label={`${product.images.length} foto, geser untuk melihat`}
              className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 md:mx-0 md:px-0 lg:grid lg:grid-cols-2 lg:overflow-visible"
            >
              {product.images.map((image, index) => (
                <li
                  key={image.url}
                  className={`relative aspect-square w-[85%] shrink-0 snap-center overflow-hidden rounded-2xl bg-muted md:w-full lg:w-auto ${
                    index === 0 ? 'lg:col-span-2' : ''
                  }`}
                >
                  <Image
                    src={image.url}
                    alt={image.alt}
                    fill
                    priority={index === 0}
                    sizes={
                      index === 0
                        ? '(min-width: 1024px) 58vw, (min-width: 768px) 50vw, 85vw'
                        : '(min-width: 1024px) 29vw, (min-width: 768px) 50vw, 85vw'
                    }
                    className="object-cover"
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-6 md:sticky md:top-24 md:self-start">
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-subhead-sm leading-tight font-semibold lg:text-subhead">
              {product.name}
            </h1>
            <p className="text-xl font-bold">
              {formatPriceRange(product.minPrice, product.maxPrice)}
            </p>
          </div>

          <AddToCart variants={product.variants} sizeChartUrl={product.sizeChartUrl} />

          {attributes.length > 0 && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t border-line pt-5 text-sm">
              {attributes.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-ink-2">{label}</dt>
                  <dd className="font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          {product.description && (
            <section className="border-t border-line pt-5">
              <h2 className="font-display text-lg font-semibold">Deskripsi</h2>
              <p className="mt-3 text-base leading-relaxed whitespace-pre-line text-ink">
                {product.description}
              </p>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
