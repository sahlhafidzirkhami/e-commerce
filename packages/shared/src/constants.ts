/** Order yang belum dibayar akan di-expire oleh job expire-order setelah durasi ini (keputusan 1 Okt 2026). */
export const ORDER_PAYMENT_TIMEOUT_HOURS = 3;

/**
 * Pengaman agar pembeli tidak bisa membayar setelah order expired:
 * halaman bayar DOKU ditutup lebih awal dari batas order, dan sesi bayar baru
 * tidak dibuka bila sisa waktunya terlalu sedikit.
 */
export const PAYMENT_WINDOW = {
  /** Batas bayar di DOKU = batas order dikurangi menit ini. */
  DOKU_MARGIN_MINUTES: 15,
  /** Sisa waktu order minimal untuk membuka sesi bayar baru. */
  MIN_REMAINING_TO_START_MINUTES: 20,
} as const;

/** TTL cache Redis (detik). */
export const CACHE_TTL = {
  SHIPPING_COST: 24 * 60 * 60,
  TRACKING: 2 * 60 * 60,
} as const;

/** Lama sesi login sebelum harus masuk ulang. */
export const SESSION_TTL_DAYS = 7;
export const SESSION_COOKIE_NAME = 'session';

/** Cookie penanda keranjang tamu. */
export const CART_COOKIE_NAME = 'cart_token';
export const CART_COOKIE_TTL_DAYS = 30;

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;
