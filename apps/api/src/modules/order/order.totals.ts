import type { OrderTotals } from '@sportswear/shared';

export interface PricedLine {
  /** Harga satuan saat ini dari database (Rupiah). */
  price: number;
  quantity: number;
  weightGram: number;
}

export function sumSubtotal(lines: readonly PricedLine[]): number {
  return lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
}

export function sumWeightGram(lines: readonly PricedLine[]): number {
  return lines.reduce((sum, line) => sum + line.weightGram * line.quantity, 0);
}

/** Satu-satunya rumus total order. Semua nilai integer Rupiah. */
export function computeTotals(
  lines: readonly PricedLine[],
  shippingCost: number,
  discount: number,
): OrderTotals {
  for (const value of [shippingCost, discount]) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`Nominal harus integer Rupiah non-negatif, dapat ${value}`);
    }
  }
  const subtotal = sumSubtotal(lines);
  // Potongan hanya untuk subtotal produk, tidak pernah memotong ongkir.
  const appliedDiscount = Math.min(discount, subtotal);
  return {
    subtotal,
    shippingCost,
    discount: appliedDiscount,
    total: subtotal - appliedDiscount + shippingCost,
  };
}
