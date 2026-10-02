import type { ProductSummary } from '@sportswear/shared';
import Image from 'next/image';
import Link from 'next/link';
import { formatPriceRange } from '@/lib/format';
import { QuickAdd } from './quick-add';

interface ProductCardProps {
  product: ProductSummary;
  /** Gambar di atas lipatan dimuat lebih dulu untuk LCP. */
  priority?: boolean;
}

export function ProductCard({ product, priority = false }: ProductCardProps) {
  return (
    <article className="group flex w-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-[box-shadow,border-color,translate] duration-200 hover:border-line-strong pointer-fine:hover:-translate-y-[3px] pointer-fine:hover:shadow-product-hover">
      <Link href={`/produk/${product.slug}`} className="flex flex-1 flex-col">
        <div className="relative aspect-square bg-muted">
          {product.image ? (
            <Image
              src={product.image.url}
              alt={product.image.alt}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
              priority={priority}
              className={`object-cover ${product.inStock ? '' : 'opacity-60'}`}
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-sm text-ink-2">
              Foto belum tersedia
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3 sm:p-4">
          <h3 className="line-clamp-2 text-[15px] leading-snug font-semibold sm:text-base">
            {product.name}
          </h3>
          <p className="mt-auto pt-1 font-bold">
            {formatPriceRange(product.minPrice, product.maxPrice)}
          </p>
        </div>
      </Link>
      <div className="px-3 pb-3 sm:px-4 sm:pb-4">
        {product.inStock ? (
          <QuickAdd slug={product.slug} productName={product.name} />
        ) : (
          <p className="inline-flex h-6 items-center rounded-sm bg-error-tint px-2 text-xs font-semibold text-error-ink">
            Stok habis
          </p>
        )}
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div
      aria-hidden
      className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface"
    >
      <div className="aspect-square animate-pulse bg-muted" />
      <div className="flex flex-col gap-2 p-3 sm:p-4">
        <span className="h-4 w-11/12 animate-pulse rounded bg-muted" />
        <span className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        <span className="mt-2 h-4 w-1/3 animate-pulse rounded bg-muted" />
        <span className="mt-2 h-11 animate-pulse rounded-full bg-muted" />
      </div>
    </div>
  );
}

export const productGridClass =
  'grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4 lg:gap-6';
