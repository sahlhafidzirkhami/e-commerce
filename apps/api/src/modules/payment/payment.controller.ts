import type { Request, RequestHandler } from 'express';
import { z } from 'zod';
import { getOrderForViewer } from '../order/order.service.js';
import { handleDokuNotification, refreshPaymentStatus, startPayment } from './payment.service.js';

const orderParamsSchema = z.object({ orderNumber: z.string().trim().min(1).max(40) });
const tokenQuerySchema = z.object({ token: z.string().trim().min(1).max(100).optional() });

function viewer(req: Request) {
  const { token } = tokenQuerySchema.parse(req.query);
  return { userId: req.user?.id, token };
}

function header(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

export const postPayment: RequestHandler = async (req, res) => {
  const { orderNumber } = orderParamsSchema.parse(req.params);
  res.json({ data: { payment: await startPayment(orderNumber, viewer(req)) } });
};

/** Dipanggil halaman pesanan saat menunggu pembayaran: cek ke DOKU bila webhook belum datang. */
export const postPaymentCheck: RequestHandler = async (req, res) => {
  const { orderNumber } = orderParamsSchema.parse(req.params);
  const who = viewer(req);
  await refreshPaymentStatus(orderNumber, who);
  const { id: _id, ...order } = await getOrderForViewer(orderNumber, who);
  res.json({ data: { order } });
};

/** POST /api/webhooks/doku — body mentah (express.raw) agar Digest bisa dihitung persis. */
export const postDokuWebhook: RequestHandler = async (req, res) => {
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  const target = new URL(req.originalUrl, 'http://localhost').pathname;
  const outcome = await handleDokuNotification(
    rawBody,
    {
      clientId: header(req, 'client-id'),
      requestId: header(req, 'request-id'),
      timestamp: header(req, 'request-timestamp'),
      signature: header(req, 'signature'),
    },
    target,
  );
  res.json({ data: { received: true, outcome } });
};
