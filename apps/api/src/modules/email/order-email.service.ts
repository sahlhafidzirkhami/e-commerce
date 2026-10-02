import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { sendMail, type MailMessage, type SendOutcome } from '../../lib/mailer.js';
import {
  renderOrderEmail,
  type OrderEmailData,
  type OrderEmailKind,
} from './order-email.templates.js';

export async function loadOrderEmailData(
  orderId: string,
): Promise<{ to: string; status: string; data: OrderEmailData } | null> {
  const o = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!o) return null;
  const query = `?token=${encodeURIComponent(o.accessToken)}`;
  return {
    to: o.customerEmail,
    status: o.status,
    data: {
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      orderUrl: `${env.WEB_URL}/pesanan/${encodeURIComponent(o.orderNumber)}${query}`,
      items: o.items.map((i) => ({
        name: i.productName,
        variant: i.variantLabel,
        quantity: i.quantity,
        subtotal: i.subtotal,
      })),
      subtotal: o.subtotal,
      shippingCost: o.shippingCost,
      discount: o.discount,
      total: o.total,
      courier: o.courier,
      courierService: o.courierService,
      trackingNumber: o.trackingNumber,
      expiresAt: o.expiresAt,
      address: {
        recipient: o.shippingRecipient,
        phone: o.shippingPhone,
        full: [
          o.shippingStreet,
          o.shippingDistrict,
          o.shippingCity,
          o.shippingProvince,
          o.shippingPostalCode,
        ].join(', '),
      },
    },
  };
}

export type OrderEmailOutcome = SendOutcome | 'order-missing' | 'stale';

/**
 * Dijalankan oleh worker antrean `email`. Data order dibaca saat email dikirim (bukan saat
 * di-enqueue) agar isi selalu terbaru, mis. nomor resi.
 */
export async function sendOrderEmail(
  kind: OrderEmailKind,
  orderId: string,
  send: (message: MailMessage) => Promise<SendOutcome> = sendMail,
): Promise<OrderEmailOutcome> {
  const loaded = await loadOrderEmailData(orderId);
  if (!loaded) {
    logger.warn({ kind, orderId }, 'Email order dilewati: order tidak ditemukan');
    return 'order-missing';
  }
  // "Silakan bayar" tidak relevan lagi bila order sudah dibayar/expired sebelum antrean jalan.
  if (kind === 'order-created' && loaded.status !== 'pending') return 'stale';

  const email = renderOrderEmail(kind, loaded.data);
  return send({ to: loaded.to, ...email });
}
