import {
  PRODUCT_SORTS,
  PRODUCT_SORT_LABELS,
  SIZE_ORDER,
  type CategorySummary,
  type ProductListResult,
} from '@sportswear/shared';
import Link from 'next/link';
import { ProductCard, productGridClass } from '@/components/product/product-card';
import { buttonClass, chipClass, inputClass } from '@/components/ui/styles';
import { catalogHref, hasActiveFilters, type CatalogFilters } from '@/lib/catalog-params';

interface CatalogViewProps {
  title: string;
  /** /produk atau /kategori/<slug>. */
  basePath: string;
  filters: CatalogFilters;
  priceError: string | null;
  categories: CategorySummary[];
  /** Diisi di halaman kategori: kategori diatur oleh path, bukan query string. */
  activeCategory?: CategorySummary;
  result: ProductListResult;
}

/** Input tersembunyi agar form harga/pencarian tidak menghapus filter lain. */
function HiddenFilters({
  filters,
  omit,
  includeCategory,
}: {
  filters: CatalogFilters;
  omit: ('q' | 'price')[];
  includeCategory: boolean;
}) {
  return (
    <>
      {includeCategory && filters.category && (
        <input type="hidden" name="kategori" value={filters.category} />
      )}
      {filters.size && <input type="hidden" name="ukuran" value={filters.size} />}
      {!omit.includes('q') && filters.q && <input type="hidden" name="q" value={filters.q} />}
      {!omit.includes('price') && filters.minPrice !== undefined && (
        <input type="hidden" name="min" value={filters.minPrice} />
      )}
      {!omit.includes('price') && filters.maxPrice !== undefined && (
        <input type="hidden" name="max" value={filters.maxPrice} />
      )}
      {filters.sort !== 'newest' && <input type="hidden" name="urut" value={filters.sort} />}
    </>
  );
}

export function CatalogView({
  title,
  basePath,
  filters,
  priceError,
  categories,
  activeCategory,
  result,
}: CatalogViewProps) {
  const includeCategory = !activeCategory;
  const href = (changes: Partial<CatalogFilters>) =>
    catalogHref(basePath, filters, changes, { includeCategory });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const filtered = hasActiveFilters(filters, { ignoreCategory: Boolean(activeCategory) });
  const currentCategory = activeCategory?.slug ?? filters.category;

  return (
    <main className="mx-auto max-w-7xl px-4 pt-6 pb-14 md:px-6 md:pb-20 lg:px-8 lg:pb-28">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <h1 className="font-display text-headline-sm leading-tight font-bold lg:text-headline">
          {title}
        </h1>
        <p className="text-sm text-ink-2" aria-live="polite">
          {result.total} produk
        </p>
      </div>

      <form action={basePath} method="get" role="search" className="mt-5 flex gap-2">
        <label htmlFor="catalog-search" className="sr-only">
          Cari produk
        </label>
        <input
          id="catalog-search"
          type="search"
          name="q"
          defaultValue={filters.q ?? ''}
          placeholder="Cari nama produk"
          className={inputClass}
        />
        <HiddenFilters filters={filters} omit={['q']} includeCategory={includeCategory} />
        <button type="submit" className={buttonClass('secondary', 'md', 'shrink-0')}>
          Cari
        </button>
      </form>

      <div className="mt-5 flex flex-col gap-4">
        {categories.length > 0 && (
          <nav aria-label="Kategori" className="-mx-4 overflow-x-auto px-4 pb-1">
            <ul className="flex gap-2">
              <li>
                <Link
                  href="/produk"
                  aria-current={!currentCategory ? 'page' : undefined}
                  className={chipClass(!currentCategory)}
                >
                  Semua
                </Link>
              </li>
              {categories.map((category) => (
                <li key={category.id}>
                  <Link
                    href={`/kategori/${category.slug}`}
                    aria-current={category.slug === currentCategory ? 'page' : undefined}
                    className={chipClass(category.slug === currentCategory)}
                  >
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <div className="-mx-4 overflow-x-auto px-4 pb-1">
          <ul aria-label="Ukuran tersedia" className="flex gap-2">
            {SIZE_ORDER.map((size) => {
              const selected = filters.size === size;
              return (
                <li key={size}>
                  <Link
                    href={href({ size: selected ? undefined : size })}
                    aria-current={selected ? 'true' : undefined}
                    className={chipClass(selected)}
                  >
                    {size}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <details
          className="rounded-2xl border border-line bg-surface"
          open={
            filters.minPrice !== undefined || filters.maxPrice !== undefined || Boolean(priceError)
          }
        >
          <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-semibold">
            Rentang harga
          </summary>
          <form action={basePath} method="get" className="flex flex-wrap items-end gap-3 px-4 pb-4">
            <div className="flex min-w-32 flex-1 flex-col gap-1">
              <label htmlFor="price-min" className="text-[13px] font-semibold">
                Harga minimum (Rp)
              </label>
              <input
                id="price-min"
                type="number"
                name="min"
                min={0}
                step={1000}
                inputMode="numeric"
                defaultValue={filters.minPrice ?? ''}
                placeholder="Contoh: 150000"
                className={inputClass}
              />
            </div>
            <div className="flex min-w-32 flex-1 flex-col gap-1">
              <label htmlFor="price-max" className="text-[13px] font-semibold">
                Harga maksimum (Rp)
              </label>
              <input
                id="price-max"
                type="number"
                name="max"
                min={0}
                step={1000}
                inputMode="numeric"
                defaultValue={filters.maxPrice ?? ''}
                placeholder="Contoh: 300000"
                className={inputClass}
              />
            </div>
            <HiddenFilters filters={filters} omit={['price']} includeCategory={includeCategory} />
            <button type="submit" className={buttonClass('secondary', 'md')}>
              Terapkan
            </button>
            {priceError && (
              <p role="alert" className="w-full text-sm font-semibold text-danger">
                {priceError}
              </p>
            )}
          </form>
        </details>

        <div className="flex flex-wrap items-center gap-2">
          <span id="sort-label" className="mr-1 text-sm font-semibold">
            Urutkan
          </span>
          <ul aria-labelledby="sort-label" className="flex flex-wrap gap-2">
            {PRODUCT_SORTS.map((sort) => (
              <li key={sort}>
                <Link
                  href={href({ sort })}
                  aria-current={filters.sort === sort ? 'true' : undefined}
                  className={chipClass(filters.sort === sort)}
                >
                  {PRODUCT_SORT_LABELS[sort]}
                </Link>
              </li>
            ))}
          </ul>
          {filtered && (
            <Link
              href={catalogHref(basePath, { sort: filters.sort, page: 1 }, {}, { includeCategory })}
              className="ml-auto inline-flex min-h-11 items-center text-sm font-semibold text-action underline underline-offset-4 hover:text-action-hover"
            >
              Hapus filter
            </Link>
          )}
        </div>
      </div>

      {result.items.length === 0 ? (
        <div className="mt-10 flex flex-col items-start gap-4 rounded-2xl border border-line bg-surface p-6">
          <p className="font-semibold">
            {filtered
              ? 'Tidak ada produk yang cocok dengan filter ini.'
              : 'Belum ada produk di kategori ini.'}
          </p>
          <Link
            href={
              filtered
                ? catalogHref(basePath, { sort: 'newest', page: 1 }, {}, { includeCategory })
                : '/produk'
            }
            className={buttonClass('primary', 'md')}
          >
            {filtered ? 'Hapus Filter' : 'Lihat Semua Produk'}
          </Link>
        </div>
      ) : (
        <ul className={`mt-6 ${productGridClass}`}>
          {result.items.map((product, index) => (
            <li key={product.id} className="flex">
              <ProductCard product={product} priority={index < 4} />
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <nav aria-label="Halaman katalog" className="mt-10 flex items-center justify-between gap-4">
          {filters.page > 1 ? (
            <Link
              href={href({ page: filters.page - 1 })}
              className={buttonClass('secondary', 'md')}
            >
              Sebelumnya
            </Link>
          ) : (
            <span />
          )}
          <p className="text-sm text-ink-2">
            Halaman {filters.page} dari {totalPages}
          </p>
          {filters.page < totalPages ? (
            <Link
              href={href({ page: filters.page + 1 })}
              className={buttonClass('secondary', 'md')}
            >
              Berikutnya
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </main>
  );
}
