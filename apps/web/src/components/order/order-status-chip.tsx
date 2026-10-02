import { ORDER_STATUS_LABELS, type OrderStatus } from '@sportswear/shared';

/** Warna chip per status (DESIGN.md: Order Status Chips). Semua pasangan lolos WCAG AA. */
const TONE: Record<OrderStatus, string> = {
  pending: 'bg-warning-tint text-warning-ink',
  paid: 'bg-[#dbeafe] text-[#1e40af]',
  processing: 'bg-[#dbeafe] text-[#1e40af]',
  shipped: 'bg-[#cffafe] text-[#155e75]',
  delivered: 'bg-[#dcfce7] text-[#166534]',
  completed: 'bg-[#dcfce7] text-[#166534]',
  expired: 'bg-muted text-[#404040]',
  cancelled: 'bg-error-tint text-error-ink',
};

export function OrderStatusChip({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex h-6 items-center rounded-sm px-2 text-xs font-semibold ${TONE[status]}`}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
