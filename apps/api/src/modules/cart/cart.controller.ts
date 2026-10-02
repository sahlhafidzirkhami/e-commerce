import {
  CART_COOKIE_NAME,
  CART_COOKIE_TTL_DAYS,
  addCartItemSchema,
  idSchema,
  updateCartItemSchema,
} from '@sportswear/shared';
import type { Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import { baseCookieOptions } from '../../lib/cookie.js';
import {
  addItem,
  getCartView,
  removeItem,
  resolveCart,
  resolveOrCreateCart,
  updateItem,
  type CartOwner,
  type ResolvedCart,
} from './cart.service.js';

const variantParamsSchema = z.object({ variantId: idSchema });

export function cartOwner(req: Request): CartOwner {
  const token: unknown = req.cookies?.[CART_COOKIE_NAME];
  return {
    userId: req.user?.id,
    token: typeof token === 'string' && token ? token : undefined,
  };
}

/** Tamu memegang token keranjang di cookie; member tidak butuh cookie ini. */
function syncCartCookie(res: Response, resolved: ResolvedCart) {
  if (resolved.cart && resolved.cart.userId === null) {
    res.cookie(CART_COOKIE_NAME, resolved.cart.token, {
      ...baseCookieOptions,
      maxAge: CART_COOKIE_TTL_DAYS * 24 * 60 * 60 * 1000,
    });
  } else if (resolved.clearGuestToken) {
    res.clearCookie(CART_COOKIE_NAME, baseCookieOptions);
  }
}

export const getCart: RequestHandler = async (req, res) => {
  const resolved = await resolveCart(cartOwner(req));
  syncCartCookie(res, resolved);
  res.json({ data: { cart: await getCartView(resolved.cart?.id ?? null) } });
};

export const postCartItem: RequestHandler = async (req, res) => {
  const input = addCartItemSchema.parse(req.body);
  const resolved = await resolveOrCreateCart(cartOwner(req));
  syncCartCookie(res, resolved);
  await addItem(resolved.cart.id, input.variantId, input.quantity);
  res.status(201).json({ data: { cart: await getCartView(resolved.cart.id) } });
};

export const patchCartItem: RequestHandler = async (req, res) => {
  const { variantId } = variantParamsSchema.parse(req.params);
  const input = updateCartItemSchema.parse(req.body);
  const resolved = await resolveOrCreateCart(cartOwner(req));
  syncCartCookie(res, resolved);
  await updateItem(resolved.cart.id, variantId, input.quantity);
  res.json({ data: { cart: await getCartView(resolved.cart.id) } });
};

export const deleteCartItem: RequestHandler = async (req, res) => {
  const { variantId } = variantParamsSchema.parse(req.params);
  const resolved = await resolveCart(cartOwner(req));
  syncCartCookie(res, resolved);
  if (resolved.cart) await removeItem(resolved.cart.id, variantId);
  res.json({ data: { cart: await getCartView(resolved.cart?.id ?? null) } });
};
