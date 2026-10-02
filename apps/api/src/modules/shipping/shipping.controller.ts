import { ErrorCode } from '@sportswear/shared';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { HttpError } from '../../lib/http-error.js';
import { prisma } from '../../lib/prisma.js';
import { cartOwner } from '../cart/cart.controller.js';
import { resolveCart } from '../cart/cart.service.js';
import { listCities, listDistricts, listProvinces } from './region.service.js';
import { getShippingRates } from './shipping.service.js';

const idParams = z.object({ id: z.coerce.number().int().positive() });
const ratesBody = z.object({ districtId: z.number().int().positive() });

export const getProvinces: RequestHandler = async (_req, res) => {
  res.json({ data: { provinces: await listProvinces() } });
};

export const getCities: RequestHandler = async (req, res) => {
  const { id } = idParams.parse(req.params);
  res.json({ data: { cities: await listCities(id) } });
};

export const getDistricts: RequestHandler = async (req, res) => {
  const { id } = idParams.parse(req.params);
  res.json({ data: { districts: await listDistricts(id) } });
};

/** Pilihan ongkir untuk isi keranjang saat ini; berat dihitung di server. */
export const postShippingRates: RequestHandler = async (req, res) => {
  const { districtId } = ratesBody.parse(req.body);
  const { cart } = await resolveCart(cartOwner(req));
  const items = cart
    ? await prisma.cartItem.findMany({
        where: { cartId: cart.id },
        select: { quantity: true, variant: { select: { weightGram: true } } },
      })
    : [];
  if (items.length === 0) {
    throw HttpError.badRequest('Keranjang masih kosong', ErrorCode.CART_EMPTY);
  }
  const weightGram = items.reduce((sum, item) => sum + item.variant.weightGram * item.quantity, 0);
  res.json({ data: { weightGram, rates: await getShippingRates(districtId, weightGram) } });
};
