import { checkoutQuoteSchema, createOrderSchema } from '@sportswear/shared';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { cartOwner } from '../cart/cart.controller.js';
import { createOrder, getOrderForViewer, quoteCheckout } from './order.service.js';

const orderParamsSchema = z.object({ orderNumber: z.string().trim().min(1).max(40) });
const orderQuerySchema = z.object({ token: z.string().trim().min(1).max(100).optional() });

export const postCheckoutQuote: RequestHandler = async (req, res) => {
  const input = checkoutQuoteSchema.parse(req.body);
  res.json({ data: { quote: await quoteCheckout(input, { owner: cartOwner(req) }) } });
};

export const postOrder: RequestHandler = async (req, res) => {
  const input = createOrderSchema.parse(req.body);
  const order = await createOrder(input, { owner: cartOwner(req) });
  res.status(201).json({
    data: {
      order: {
        orderNumber: order.orderNumber,
        accessToken: order.accessToken,
        total: order.total,
      },
    },
  });
};

export const getOrder: RequestHandler = async (req, res) => {
  const { orderNumber } = orderParamsSchema.parse(req.params);
  const { token } = orderQuerySchema.parse(req.query);
  const { id: _id, ...order } = await getOrderForViewer(orderNumber, {
    userId: req.user?.id,
    token,
  });
  res.json({ data: { order } });
};
