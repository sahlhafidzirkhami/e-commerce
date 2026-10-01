import Link from 'next/link';
import { connection } from 'next/server';
import { ProductCard, productGridClass } from '@/components/product/product-card';
import { buttonClass, chipClass } from '@/components/ui/styles';
import { fetchCategories, fetchProducts } from '@/lib/api';

const NEWEST_COUNT = 8;

export default async function HomePage() {
  // Dirender per request agar `next build` tidak butuh API; data tetap di-cache 60 detik.
  await connection();
  const [categories, newest] = await Promise.all([
    fetchCategories(),
    fetchProducts({ sort: 'newest', pageSize: NEWEST_COUNT }),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-4 pb-14 md:px-6 md:pb-20 lg:px-8 lg:pb-28">
      <section className="pt-10 pb-8 md:pt-14 lg:pt-20">
        <h1 className="max-w-3xl font-display text-display-sm leading-[1.1] font-extrabold tracking-[0.02em] lg:text-display">
          Sportswear 3ON
        </h1>
        <p className="mt-4 max-w-prose text-[17px] leading-relaxed text-ink-2 lg:text-lg">
          Kaos, polo, celana, legging, jaket, topi, dan tas. Dikirim ke seluruh Indonesia.
        </p>
        {categories.length > 0 && (
          <nav aria-label="Kategori" className="-mx-4 mt-6 overflow-x-auto px-4 pb-1">
            <ul className="flex gap-2">
              {categories.map((category) => (
                <li key={category.id}>
                  <Link href={`/kategori/${category.slug}`} className={chipClass(false)}>
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </section>

      <section aria-labelledby="newest-heading" className="border-t border-line pt-8 md:pt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2
            id="newest-heading"
            className="font-display text-subhead-sm leading-tight font-semibold lg:text-subhead"
          >
            Produk terbaru
          </h2>
          <Link
            href="/produk"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-action underline underline-offset-4 hover:text-action-hover"
          >
            Lihat semua {newest.total} produk
          </Link>
        </div>
        {newest.items.length === 0 ? (
          <p className="mt-6 text-ink-2">Belum ada produk yang dijual.</p>
        ) : (
          <ul className={`mt-6 ${productGridClass}`}>
            {newest.items.map((product, index) => (
              <li key={product.id} className="flex">
                <ProductCard product={product} priority={index < 2} />
              </li>
            ))}
          </ul>
        )}
        {newest.total > NEWEST_COUNT && (
          <div className="mt-8 flex justify-center">
            <Link href="/produk" className={buttonClass('secondary', 'md')}>
              Lihat Semua Produk
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
