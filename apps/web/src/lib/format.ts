const rupiahFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

/** Satu-satunya tempat format Rupiah untuk tampilan. Input = integer Rupiah dari API. */
export function formatRupiah(amount: number): string {
  return rupiahFormatter.format(amount);
}
