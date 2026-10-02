import type { Metadata } from 'next';
import { AddressBook } from '@/components/account/address-book';

export const metadata: Metadata = { title: 'Buku Alamat' };

export default function AccountAddressesPage() {
  return <AddressBook />;
}
