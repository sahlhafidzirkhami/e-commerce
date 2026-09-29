/** Order yang belum dibayar akan di-expire oleh job expire-order setelah durasi ini. */
export const ORDER_PAYMENT_TIMEOUT_HOURS = 24;

/** TTL cache Redis (detik). */
export const CACHE_TTL = {
  SHIPPING_COST: 24 * 60 * 60,
  TRACKING: 2 * 60 * 60,
} as const;

/** Lama sesi login sebelum harus masuk ulang. */
export const SESSION_TTL_DAYS = 7;
export const SESSION_COOKIE_NAME = 'session';

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;
