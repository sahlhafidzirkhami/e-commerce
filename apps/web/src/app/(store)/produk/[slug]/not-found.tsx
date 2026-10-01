import { NotFoundView } from '@/components/not-found-view';

export default function ProductNotFound() {
  return (
    <NotFoundView
      title="Produk tidak ditemukan"
      message="Produk ini mungkin sudah tidak dijual atau alamatnya salah."
    />
  );
}
