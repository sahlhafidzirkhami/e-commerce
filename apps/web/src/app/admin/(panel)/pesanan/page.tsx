import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminOrderList } from '@/components/admin/admin-order-list';

export const metadata: Metadata = { title: 'Pesanan' };

export default function AdminOrdersPage() {
  return (
    // useSearchParams (filter di URL) butuh Suspense boundary.
    <Suspense>
      <AdminOrderList />
    </Suspense>
  );
}
