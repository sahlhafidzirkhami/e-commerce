'use client';

import { buttonClass } from '@/components/ui/styles';

/** Error saat memuat halaman toko (mis. API tidak bisa dihubungi). */
export default function StoreError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex max-w-7xl flex-col items-start gap-4 px-4 py-14 md:px-6 lg:px-8">
      <h1 className="font-display text-subhead-sm font-semibold lg:text-subhead">
        Halaman gagal dimuat
      </h1>
      <p className="max-w-prose text-ink-2">
        Server toko sedang tidak bisa dihubungi. Coba lagi beberapa saat lagi.
      </p>
      <button type="button" onClick={reset} className={buttonClass('primary', 'md')}>
        Coba Lagi
      </button>
    </main>
  );
}
