import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AccountTabs } from '@/components/account/account-tabs';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Akun Saya',
  robots: { index: false },
};

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/masuk?next=/akun');

  return (
    <main className="mx-auto max-w-3xl px-4 pt-6 pb-14 md:px-6">
      <h1 className="font-display text-headline-sm leading-tight font-bold">Akun Saya</h1>
      <p className="mt-1 text-sm text-ink-2">{user.email}</p>
      <AccountTabs />
      <div className="mt-6">{children}</div>
    </main>
  );
}
