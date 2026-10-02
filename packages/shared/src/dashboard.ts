import type { OrderStatus } from './order-status.js';

/**
 * Status yang dihitung sebagai omzet: sudah dibayar dan tidak dibatalkan.
 * Omzet = total pesanan (subtotal + ongkir − voucher), sesuai yang dibayar pembeli.
 */
export const REVENUE_STATUSES: readonly OrderStatus[] = [
  'paid',
  'processing',
  'shipped',
  'delivered',
  'completed',
];

/** Varian dengan stok ≤ angka ini tampil di "stok menipis" (nanti bisa diatur owner, F-23). */
export const LOW_STOCK_THRESHOLD = 3;

/** Rentang grafik omzet dan produk terlaris. */
export const DASHBOARD_DAYS = 30;

export interface DailyRevenue {
  /** Tanggal WIB, "YYYY-MM-DD". */
  date: string;
  revenue: number;
  orders: number;
}

export interface AdminDashboard {
  /** Waktu perhitungan (ISO), untuk label "per hari ini". */
  generatedAt: string;
  today: { revenue: number; orders: number };
  thisMonth: { revenue: number; orders: number };
  /** DASHBOARD_DAYS hari terakhir, termasuk hari ini; hari tanpa penjualan bernilai 0. */
  daily: DailyRevenue[];
  countsByStatus: Record<OrderStatus, number>;
  /** Maks. 10 produk terlaris dalam DASHBOARD_DAYS hari terakhir. */
  topProducts: {
    productId: string;
    name: string;
    imageUrl: string | null;
    quantity: number;
    revenue: number;
  }[];
  lowStockThreshold: number;
  lowStock: {
    productId: string;
    productName: string;
    size: string;
    sku: string;
    stock: number;
  }[];
}
