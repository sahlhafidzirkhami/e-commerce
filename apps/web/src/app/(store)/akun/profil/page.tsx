import type { Metadata } from 'next';
import { AccountProfile } from '@/components/account/account-profile';

export const metadata: Metadata = { title: 'Profil Akun' };

export default function AccountProfilePage() {
  return <AccountProfile />;
}
