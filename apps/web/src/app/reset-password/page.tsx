import type { Metadata } from 'next';
import Link from 'next/link';
import { ResetPasswordForm } from '@/components/password-reset-forms';
import { buttonClass } from '@/components/ui/styles';

export const metadata: Metadata = {
  title: 'Buat Password Baru',
  // Token ada di URL: jangan diindeks dan jangan bocor lewat Referer.
  robots: { index: false },
  referrer: 'no-referrer',
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const raw = (await searchParams).token;
  const token = Array.isArray(raw) ? raw[0] : raw;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">Buat password baru</h1>
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-2">
            Tautan tidak lengkap. Buka tautan dari email, atau minta tautan baru.
          </p>
          <Link href="/lupa-password" className={buttonClass('primary', 'md')}>
            Minta Tautan Baru
          </Link>
        </div>
      )}
    </main>
  );
}
