import type { Metadata } from 'next';
import { AccountOrders } from '@/components/account/account-orders';

export const metadata: Metadata = { title: 'Pesanan Saya' };

export default function AccountOrdersPage() {
  return <AccountOrders />;
}
