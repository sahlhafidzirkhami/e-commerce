import type { Metadata } from 'next';
import { AdminCategoryPage } from '@/components/admin/admin-category-page';

export const metadata: Metadata = { title: 'Kategori' };

export default function AdminCategoriesPage() {
  return <AdminCategoryPage />;
}
