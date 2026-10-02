import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminProductEdit } from '@/components/admin/admin-product-edit';

export const metadata: Metadata = { title: 'Ubah Produk' };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <AdminProductEdit id={id} />
    </Suspense>
  );
}
