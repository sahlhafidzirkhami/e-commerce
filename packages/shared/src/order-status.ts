/**
 * Status order — satu-satunya sumber kebenaran untuk seluruh monorepo.
 * Enum Prisma di apps/api harus identik dengan daftar ini.
 */
export const OrderStatus = {
  PENDING: 'pending',
  PAID: 'paid',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const ORDER_STATUSES = Object.values(OrderStatus) as readonly OrderStatus[];

/**
 * State machine order:
 *   pending → paid → processing → shipped → delivered → completed
 *   pending → expired
 *   pending | paid | processing → cancelled
 */
export const ORDER_STATUS_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.EXPIRED, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.EXPIRED]: [],
  [OrderStatus.CANCELLED]: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}

/** Status yang mengembalikan stok yang sudah direservasi. */
export const STOCK_RELEASING_STATUSES: readonly OrderStatus[] = [
  OrderStatus.EXPIRED,
  OrderStatus.CANCELLED,
];

export function isFinalStatus(status: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[status].length === 0;
}

export const ORDER_STATUS_LABEL: Readonly<Record<OrderStatus, string>> = {
  [OrderStatus.PENDING]: 'Menunggu Pembayaran',
  [OrderStatus.PAID]: 'Dibayar',
  [OrderStatus.PROCESSING]: 'Diproses',
  [OrderStatus.SHIPPED]: 'Dikirim',
  [OrderStatus.DELIVERED]: 'Diterima',
  [OrderStatus.COMPLETED]: 'Selesai',
  [OrderStatus.EXPIRED]: 'Kedaluwarsa',
  [OrderStatus.CANCELLED]: 'Dibatalkan',
};
