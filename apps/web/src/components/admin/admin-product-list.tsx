'use client';

import type { AdminCategory, AdminProductListResult } from '@sportswear/shared';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { buttonClass, inputClass } from '@/components/ui/styles';
import { adminProductApi } from '@/lib/admin-client';
import { errorMessage } from '@/lib/api-client';
import { formatPriceRange } from '@/lib/format';

type Load =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: AdminProductListResult };

const selectClass = `${inputClass} sm:w-auto`;

export function AdminProductList() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const q = params.get('q') ?? '';
  const categoryId = params.get('kategori') ?? '';
  const statusParam = params.get('status');
  const status = statusParam === 'active' || statusParam === 'inactive' ? statusParam : '';
  const page = Math.max(1, Number(params.get('halaman')) || 1);

  const [state, setState] = useState<Load>({ status: 'loading' });
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [search, setSearch] = useState(q);

  useEffect(() => {
    adminProductApi
      .categories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    adminProductApi
      .list({
        page,
        ...(q && { q }),
        ...(categoryId && { categoryId }),
        ...(status && { status }),
      })
      .then((data) => !cancelled && setState({ status: 'ready', data }))
      .catch(
        (err: unknown) => !cancelled && setState({ status: 'error', message: errorMessage(err) }),
      );
    return () => {
      cancelled = true;
    };
  }, [q, categoryId, status, page]);

  function go(changes: Record<string, string | number | undefined>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined || value === '' || value === 1) next.delete(key);
      else next.set(key, String(value));
    }
    if (!('halaman' in changes)) next.delete('halaman');
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    go({ q: search.trim() });
  }

  const totalPages =
    state.status === 'ready' ? Math.max(1, Math.ceil(state.data.total / state.data.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-headline-sm leading-tight font-bold">Produk</h1>
        <Link href="/admin/produk/baru" className={buttonClass('primary', 'md')}>
          Tambah Produk
        </Link>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <form onSubmit={submitSearch} role="search" className="flex flex-1 gap-2">
          <label htmlFor="product-search" className="sr-only">
            Cari produk
          </label>
          <input
            id="product-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nama atau SKU"
            className={inputClass}
          />
          <button type="submit" className={buttonClass('secondary', 'md', 'shrink-0')}>
            Cari
          </button>
        </form>
        <label htmlFor="filter-category" className="sr-only">
          Kategori
        </label>
        <select
          id="filter-category"
          value={categoryId}
          onChange={(e) => go({ kategori: e.target.value })}
          className={selectClass}
        >
          <option value="">Semua kategori</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label htmlFor="filter-status" className="sr-only">
          Status
        </label>
        <select
          id="filter-status"
          value={status}
          onChange={(e) => go({ status: e.target.value })}
          className={selectClass}
        >
          <option value="">Aktif dan nonaktif</option>
          <option value="active">Hanya aktif</option>
          <option value="inactive">Hanya nonaktif</option>
        </select>
      </div>

      {state.status === 'loading' ? (
        <div role="status" className="flex flex-col gap-2">
          <span className="sr-only">Memuat produk...</span>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} aria-hidden className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : state.status === 'error' ? (
        <p role="alert" className="font-semibold text-danger">
          {state.message}
        </p>
      ) : state.data.items.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-6">
          <p className="font-semibold">
            {q || categoryId || status
              ? 'Tidak ada produk yang cocok dengan filter ini.'
              : 'Belum ada produk.'}
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-ink-2">{state.data.total} produk</p>
          <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
            {state.data.items.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/admin/produk/${p.id}`}
                  className="flex gap-3 p-3 hover:bg-page sm:items-center sm:gap-4 sm:p-4"
                >
                  <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                    {p.imageUrl && (
                      <Image src={p.imageUrl} alt="" fill sizes="64px" className="object-cover" />
                    )}
                  </span>
                  <span className="grid min-w-0 flex-1 gap-1 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1.5fr)_9rem_6rem] sm:items-center sm:gap-4">
                    <span className="min-w-0">
                      <span className="line-clamp-2 text-sm font-semibold">{p.name}</span>
                      <span className="block font-mono text-xs text-ink-2">
                        {p.sku} · {p.category?.name ?? 'Tanpa kategori'}
                      </span>
                    </span>
                    <span className="flex flex-wrap gap-1 text-xs">
                      {p.variants.map((v) => (
                        <span
                          key={v.size}
                          className={`rounded-sm px-1.5 py-0.5 tabular-nums ${
                            !v.isActive
                              ? 'bg-muted text-ink-2 line-through'
                              : v.stock === 0
                                ? 'bg-error-tint text-error-ink'
                                : 'bg-muted text-ink'
                          }`}
                        >
                          {v.size} {v.stock}
                        </span>
                      ))}
                    </span>
                    <span className="text-sm font-semibold">
                      {p.minPrice === null
                        ? 'Belum ada harga'
                        : formatPriceRange(p.minPrice, p.maxPrice ?? p.minPrice)}
                    </span>
                    <span>
                      <span
                        className={`inline-flex h-6 items-center rounded-sm px-2 text-xs font-semibold ${
                          p.isActive ? 'bg-[#dcfce7] text-[#166534]' : 'bg-muted text-[#404040]'
                        }`}
                      >
                        {p.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {totalPages > 1 && (
            <nav aria-label="Halaman produk" className="flex items-center justify-between gap-4">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => go({ halaman: page - 1 })}
                className={buttonClass('secondary', 'md')}
              >
                Sebelumnya
              </button>
              <p className="text-sm text-ink-2">
                Halaman {page} dari {totalPages}
              </p>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => go({ halaman: page + 1 })}
                className={buttonClass('secondary', 'md')}
              >
                Berikutnya
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
