import type { Metadata } from 'next';
import { Suspense } from 'react';
import { OrderPageView } from '@/components/order/order-view';

export const metadata: Metadata = {
  title: 'Pesanan',
  robots: { index: false },
};

export default async function OrderPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  return (
    // useSearchParams (token di URL) butuh Suspense boundary.
    <Suspense>
      <OrderPageView orderNumber={decodeURIComponent(orderNumber)} />
    </Suspense>
  );
}
