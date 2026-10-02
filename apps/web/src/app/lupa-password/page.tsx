import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/password-reset-forms';

export const metadata: Metadata = {
  title: 'Lupa Password',
  robots: { index: false },
};

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">Lupa password</h1>
      <ForgotPasswordForm />
    </main>
  );
}
