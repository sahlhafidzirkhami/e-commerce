import { OrderStatus } from './order-status.js';

/** Label status untuk storefront dan admin (DESIGN.md: Order Status Chips). */
export const ORDER_STATUS_LABELS: Readonly<Record<OrderStatus, string>> = {
  [OrderStatus.PENDING]: 'Menunggu Pembayaran',
  [OrderStatus.PAID]: 'Dibayar',
  [OrderStatus.PROCESSING]: 'Dikemas',
  [OrderStatus.SHIPPED]: 'Dikirim',
  [OrderStatus.DELIVERED]: 'Diterima',
  [OrderStatus.COMPLETED]: 'Selesai',
  [OrderStatus.EXPIRED]: 'Kedaluwarsa',
  [OrderStatus.CANCELLED]: 'Dibatalkan',
};

/** Rincian total yang selalu dihitung di server (Rupiah, integer). */
export interface OrderTotals {
  subtotal: number;
  shippingCost: number;
  discount: number;
  total: number;
}

export interface CheckoutQuote extends OrderTotals {
  totalWeightGram: number;
  voucher: { code: string; discount: number } | null;
}

/** Data untuk membuka pop-up DOKU Checkout (CLAUDE.md: Pembayaran DOKU). */
export interface PaymentSession {
  paymentUrl: string;
  /** Script pop-up sesuai DOKU_ENV; frontend tidak menentukan sandbox/production sendiri. */
  checkoutScriptUrl: string;
  /** Batas bayar halaman DOKU (ISO). */
  expiresAt: string;
}

export interface OrderItemView {
  productName: string;
  variantLabel: string;
  sku: string;
  price: number;
  quantity: number;
  subtotal: number;
}

/** Baris daftar pesanan di admin. */
export interface AdminOrderSummary {
  orderNumber: string;
  status: OrderStatus;
  customerName: string;
  customerEmail: string;
  itemCount: number;
  total: number;
  courier: string;
  courierService: string;
  trackingNumber: string | null;
  createdAt: string;
  paidAt: string | null;
}

export interface AdminOrderListResult {
  items: AdminOrderSummary[];
  page: number;
  pageSize: number;
  total: number;
  /** Jumlah pesanan per status, untuk tab filter. */
  countsByStatus: Record<OrderStatus, number>;
}

export interface AdminOrderDetail extends OrderView {
  isGuest: boolean;
  totalWeightGram: number;
  history: {
    fromStatus: OrderStatus | null;
    toStatus: OrderStatus;
    note: string | null;
    changedBy: string | null;
    createdAt: string;
  }[];
  payments: {
    invoiceNumber: string;
    status: string;
    amount: number;
    method: string | null;
    paidAt: string | null;
    createdAt: string;
  }[];
}

export interface OrderView extends OrderTotals {
  orderNumber: string;
  status: OrderStatus;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shipping: {
    recipient: string;
    phone: string;
    street: string;
    district: string;
    city: string;
    province: string;
    postalCode: string;
    courier: string;
    service: string;
    trackingNumber: string | null;
  };
  items: OrderItemView[];
  voucherCode: string | null;
  notes: string | null;
  createdAt: string;
  /** Batas bayar untuk order pending. */
  expiresAt: string;
  paidAt: string | null;
  /** Pesanan sudah terhubung ke akun member (tawaran buat akun tidak ditampilkan). */
  hasAccount: boolean;
}
