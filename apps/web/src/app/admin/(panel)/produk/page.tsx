import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminProductList } from '@/components/admin/admin-product-list';

export const metadata: Metadata = { title: 'Produk' };

export default function AdminProductsPage() {
  return (
    <Suspense>
      <AdminProductList />
    </Suspense>
  );
}
