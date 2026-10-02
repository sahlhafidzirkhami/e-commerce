import type { Metadata } from 'next';
import { AdminOrderDetailView } from '@/components/admin/admin-order-detail';

export const metadata: Metadata = { title: 'Detail Pesanan' };

export default async function AdminOrderPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  return <AdminOrderDetailView orderNumber={decodeURIComponent(orderNumber)} />;
}
