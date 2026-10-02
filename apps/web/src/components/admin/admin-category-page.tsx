'use client';

import type { AdminCategory } from '@sportswear/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { buttonClass, inputClass } from '@/components/ui/styles';
import { adminProductApi } from '@/lib/admin-client';
import { errorMessage } from '@/lib/api-client';

type Load =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; categories: AdminCategory[] };

/** Kategori tidak dihapus, cukup dinonaktifkan; slug tetap walau nama diubah. */
export function AdminCategoryPage() {
  const [state, setState] = useState<Load>({ status: 'loading' });
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    adminProductApi
      .categories()
      .then((categories) => setState({ status: 'ready', categories }))
      .catch((err: unknown) => setState({ status: 'error', message: errorMessage(err) }));
  }, []);

  async function add(event: FormEvent) {
    event.preventDefault();
    if (state.status !== 'ready') return;
    setAdding(true);
    setAddError(null);
    try {
      const sortOrder = Math.max(0, ...state.categories.map((c) => c.sortOrder + 1));
      const categories = await adminProductApi.createCategory({
        name: name.trim(),
        isActive: true,
        sortOrder: Math.min(sortOrder, 999),
      });
      setState({ status: 'ready', categories });
      setName('');
    } catch (err) {
      setAddError(errorMessage(err));
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <h1 className="font-display text-headline-sm leading-tight font-bold">Kategori</h1>

      <form
        onSubmit={(e) => void add(e)}
        className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4 sm:p-6"
      >
        <label htmlFor="category-name" className="text-[13px] font-semibold">
          Kategori baru
        </label>
        <div className="flex gap-2">
          <input
            id="category-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="mis. Celana Training"
            className={inputClass}
          />
          <button
            type="submit"
            disabled={adding || name.trim().length < 2}
            className={buttonClass('primary', 'md', 'shrink-0')}
          >
            {adding ? 'Menambah...' : 'Tambah'}
          </button>
        </div>
        {addError && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {addError}
          </p>
        )}
      </form>

      {state.status === 'loading' ? (
        <p role="status" className="text-ink-2">
          Memuat kategori...
        </p>
      ) : state.status === 'error' ? (
        <p role="alert" className="font-semibold text-danger">
          {state.message}
        </p>
      ) : state.categories.length === 0 ? (
        <p className="text-ink-2">Belum ada kategori.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
          {state.categories.map((c) => (
            <CategoryRow
              key={c.id}
              category={c}
              onSaved={(categories) => setState({ status: 'ready', categories })}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function CategoryRow({
  category,
  onSaved,
}: {
  category: AdminCategory;
  onSaved: (categories: AdminCategory[]) => void;
}) {
  const [name, setName] = useState(category.name);
  const [sortOrder, setSortOrder] = useState(String(category.sortOrder));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(category.name);
    setSortOrder(String(category.sortOrder));
  }, [category.name, category.sortOrder]);

  async function save(isActive: boolean) {
    setPending(true);
    setError(null);
    try {
      onSaved(
        await adminProductApi.updateCategory(category.id, {
          name: name.trim(),
          sortOrder: Number(sortOrder),
          isActive,
        }),
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  const changed = name !== category.name || sortOrder !== String(category.sortOrder);

  return (
    <li className={`flex flex-col gap-2 p-4 ${category.isActive ? '' : 'bg-page'}`}>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-[13px] font-semibold">
          Nama
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold">
          Urutan
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={999}
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className={`${inputClass} w-20`}
          />
        </label>
        {changed && (
          <button
            type="button"
            disabled={pending}
            onClick={() => void save(category.isActive)}
            className={buttonClass('secondary', 'md')}
          >
            Simpan
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-2">
        <span>
          <span className="font-mono">/kategori/{category.slug}</span> · {category.productCount}{' '}
          produk
          {!category.isActive && ' · nonaktif, tidak tampil di toko'}
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={() => void save(!category.isActive)}
          className={buttonClass('ghost', 'sm')}
        >
          {category.isActive ? 'Nonaktifkan' : 'Aktifkan'}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </li>
  );
}
