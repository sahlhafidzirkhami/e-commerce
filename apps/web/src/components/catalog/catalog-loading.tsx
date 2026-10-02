import { ProductCardSkeleton, productGridClass } from '@/components/product/product-card';

/** Skeleton katalog yang mengikuti tata letak grid sebenarnya. */
export function CatalogLoading() {
  return (
    <main className="mx-auto max-w-7xl px-4 pt-6 pb-14 md:px-6 lg:px-8" aria-busy="true">
      <p className="sr-only" role="status">
        Memuat produk...
      </p>
      <span aria-hidden className="block h-9 w-48 animate-pulse rounded-lg bg-muted" />
      <span aria-hidden className="mt-5 block h-12 animate-pulse rounded-xl bg-muted" />
      <div className={`mt-6 ${productGridClass}`}>
        {Array.from({ length: 8 }, (_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </main>
  );
}
