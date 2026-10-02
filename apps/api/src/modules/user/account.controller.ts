import {
  accountFromOrderSchema,
  addressInputSchema,
  deleteAccountSchema,
  profileInputSchema,
} from '@sportswear/shared';
import type { Request, RequestHandler } from 'express';
import { z } from 'zod';
import { HttpError } from '../../lib/http-error.js';
import { endSession, startSession } from '../auth/auth.controller.js';
import { toAuthUser } from '../auth/auth.service.js';
import {
  createAccountFromOrder,
  createAddress,
  deleteAccount,
  deleteAddress,
  listAddresses,
  listMyOrders,
  setDefaultAddress,
  updateAddress,
  updateProfile,
} from './account.service.js';

const idParams = z.object({ id: z.string().min(1).max(40) });
const pageQuery = z.object({ page: z.coerce.number().int().min(1).default(1) });
const orderParams = z.object({ orderNumber: z.string().min(1).max(40) });

/** requireAuth sudah menjamin req.user ada. */
function userId(req: Request): string {
  if (!req.user) throw HttpError.unauthorized();
  return req.user.id;
}

export const getMyOrders: RequestHandler = async (req, res) => {
  const { page } = pageQuery.parse(req.query);
  res.json({ data: await listMyOrders(userId(req), page) });
};

export const getAddresses: RequestHandler = async (req, res) => {
  res.json({ data: { addresses: await listAddresses(userId(req)) } });
};

export const postAddress: RequestHandler = async (req, res) => {
  const input = addressInputSchema.parse(req.body);
  res.status(201).json({ data: { addresses: await createAddress(userId(req), input) } });
};

export const putAddress: RequestHandler = async (req, res) => {
  const { id } = idParams.parse(req.params);
  const input = addressInputSchema.parse(req.body);
  res.json({ data: { addresses: await updateAddress(userId(req), id, input) } });
};

export const postDefaultAddress: RequestHandler = async (req, res) => {
  const { id } = idParams.parse(req.params);
  res.json({ data: { addresses: await setDefaultAddress(userId(req), id) } });
};

export const removeAddress: RequestHandler = async (req, res) => {
  const { id } = idParams.parse(req.params);
  res.json({ data: { addresses: await deleteAddress(userId(req), id) } });
};

export const putProfile: RequestHandler = async (req, res) => {
  const input = profileInputSchema.parse(req.body);
  res.json({ data: { user: await updateProfile(userId(req), input) } });
};

export const removeAccount: RequestHandler = async (req, res) => {
  const { password } = deleteAccountSchema.parse(req.body);
  await deleteAccount(userId(req), password);
  endSession(res);
  res.json({ data: { deleted: true } });
};

export const postAccountFromOrder: RequestHandler = async (req, res) => {
  const { orderNumber } = orderParams.parse(req.params);
  const { token, password } = accountFromOrderSchema.parse(req.body);
  const user = await createAccountFromOrder(orderNumber, token, password);
  await startSession(res, user);
  res.status(201).json({ data: { user: toAuthUser(user) } });
};
