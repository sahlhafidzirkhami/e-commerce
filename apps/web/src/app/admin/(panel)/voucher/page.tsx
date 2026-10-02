import type { Metadata } from 'next';
import { AdminVoucherPage } from '@/components/admin/admin-voucher-page';

export const metadata: Metadata = { title: 'Voucher' };

export default function VoucherPage() {
  return <AdminVoucherPage />;
}
