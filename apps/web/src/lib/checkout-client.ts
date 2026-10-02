import type {
  CheckoutQuote,
  CheckoutQuoteInput,
  CreateOrderInput,
  OrderView,
  PaymentSession,
} from '@sportswear/shared';
import { apiFetch } from './api-client';

export interface RegionOption {
  id: number;
  name: string;
}

export interface DistrictOption extends RegionOption {
  postalCode: string | null;
}

export interface ShippingRate {
  courier: string;
  courierName: string;
  service: string;
  description: string;
  cost: number;
  etd: string;
}

function tokenQuery(token: string | null): string {
  return token ? `?token=${encodeURIComponent(token)}` : '';
}

export const checkoutApi = {
  provinces: () =>
    apiFetch<{ provinces: RegionOption[] }>('/regions/provinces').then((d) => d.provinces),
  cities: (provinceId: number) =>
    apiFetch<{ cities: RegionOption[] }>(`/regions/provinces/${provinceId}/cities`).then(
      (d) => d.cities,
    ),
  districts: (cityId: number) =>
    apiFetch<{ districts: DistrictOption[] }>(`/regions/cities/${cityId}/districts`).then(
      (d) => d.districts,
    ),
  rates: (districtId: number) =>
    apiFetch<{ weightGram: number; rates: ShippingRate[] }>('/shipping/rates', {
      method: 'POST',
      body: JSON.stringify({ districtId }),
    }),
  quote: (input: CheckoutQuoteInput) =>
    apiFetch<{ quote: CheckoutQuote }>('/checkout/quote', {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((d) => d.quote),
  createOrder: (input: CreateOrderInput) =>
    apiFetch<{ order: { orderNumber: string; accessToken: string; total: number } }>('/orders', {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((d) => d.order),
  order: (orderNumber: string, token: string | null) =>
    apiFetch<{ order: OrderView }>(
      `/orders/${encodeURIComponent(orderNumber)}${tokenQuery(token)}`,
    ).then((d) => d.order),
  startPayment: (orderNumber: string, token: string | null) =>
    apiFetch<{ payment: PaymentSession }>(
      `/orders/${encodeURIComponent(orderNumber)}/payment${tokenQuery(token)}`,
      { method: 'POST' },
    ).then((d) => d.payment),
  checkPayment: (orderNumber: string, token: string | null) =>
    apiFetch<{ order: OrderView }>(
      `/orders/${encodeURIComponent(orderNumber)}/payment/check${tokenQuery(token)}`,
      { method: 'POST' },
    ).then((d) => d.order),
};
