import Link from 'next/link';
import { buttonClass } from '@/components/ui/styles';

export function NotFoundView({
  title = 'Halaman tidak ditemukan',
  message = 'Alamat ini tidak ada atau sudah dipindahkan.',
}: {
  title?: string;
  message?: string;
}) {
  return (
    <main className="mx-auto flex max-w-7xl flex-col items-start gap-4 px-4 py-14 md:px-6 lg:px-8">
      <h1 className="font-display text-subhead-sm font-semibold lg:text-subhead">{title}</h1>
      <p className="max-w-prose text-ink-2">{message}</p>
      <Link href="/produk" className={buttonClass('primary', 'md')}>
        Lihat Semua Produk
      </Link>
    </main>
  );
}
