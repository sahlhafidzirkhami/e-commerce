import type { Metadata } from 'next';
import { AdminProductCreate } from '@/components/admin/admin-product-create';

export const metadata: Metadata = { title: 'Tambah Produk' };

export default function NewProductPage() {
  return <AdminProductCreate />;
}
