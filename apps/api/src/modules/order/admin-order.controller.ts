import { adminOrderListQuerySchema, cancelOrderSchema, shipOrderSchema } from '@sportswear/shared';
import type { Request, RequestHandler } from 'express';
import { z } from 'zod';
import { HttpError } from '../../lib/http-error.js';
import {
  cancelOrder,
  getAdminOrder,
  listAdminOrders,
  markDelivered,
  processOrder,
  shipOrder,
} from './admin-order.service.js';

const paramsSchema = z.object({ orderNumber: z.string().trim().min(1).max(40) });

/** requireAdmin sudah menjamin req.user ada; ini hanya penyempit tipe. */
function adminId(req: Request): string {
  if (!req.user) throw HttpError.unauthorized();
  return req.user.id;
}

export const getOrders: RequestHandler = async (req, res) => {
  const query = adminOrderListQuerySchema.parse(req.query);
  res.json({ data: await listAdminOrders(query) });
};

export const getOrder: RequestHandler = async (req, res) => {
  const { orderNumber } = paramsSchema.parse(req.params);
  res.json({ data: { order: await getAdminOrder(orderNumber) } });
};

/** Setiap aksi mengembalikan detail terbaru agar UI tidak perlu memuat ulang. */
export const postProcess: RequestHandler = async (req, res) => {
  const { orderNumber } = paramsSchema.parse(req.params);
  await processOrder(orderNumber, adminId(req));
  res.json({ data: { order: await getAdminOrder(orderNumber) } });
};

export const postShip: RequestHandler = async (req, res) => {
  const { orderNumber } = paramsSchema.parse(req.params);
  const { trackingNumber } = shipOrderSchema.parse(req.body);
  await shipOrder(orderNumber, trackingNumber, adminId(req));
  res.json({ data: { order: await getAdminOrder(orderNumber) } });
};

export const postDeliver: RequestHandler = async (req, res) => {
  const { orderNumber } = paramsSchema.parse(req.params);
  await markDelivered(orderNumber, adminId(req));
  res.json({ data: { order: await getAdminOrder(orderNumber) } });
};

export const postCancel: RequestHandler = async (req, res) => {
  const { orderNumber } = paramsSchema.parse(req.params);
  const { reason } = cancelOrderSchema.parse(req.body);
  await cancelOrder(orderNumber, reason, adminId(req));
  res.json({ data: { order: await getAdminOrder(orderNumber) } });
};
