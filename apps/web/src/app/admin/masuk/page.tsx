import { isAdminRole } from '@sportswear/shared';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth-form';
import { getCurrentUser, safeNextPath } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Masuk',
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; akses?: string }>;
}) {
  const params = await searchParams;
  const requested = safeNextPath(params.next, '/admin');
  const next = requested.startsWith('/admin') ? requested : '/admin';

  const user = await getCurrentUser();
  if (user && isAdminRole(user.role)) redirect(next);
  const loggedInAsCustomer = Boolean(user) || params.akses === 'ditolak';

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <p className="text-sm font-semibold tracking-wide text-neutral-500 uppercase">
        Sportswear Store
      </p>
      <h1 className="mt-1 mb-6 text-2xl font-bold">Masuk Admin Panel</h1>

      {loggedInAsCustomer && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Akun yang sedang digunakan tidak memiliki akses admin. Masuk dengan akun admin.
        </p>
      )}

      <AuthForm mode="admin" next={next} />
    </main>
  );
}
