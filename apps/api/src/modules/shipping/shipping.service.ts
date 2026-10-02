import { CACHE_TTL, ErrorCode } from '@sportswear/shared';
import { z } from 'zod';
import { HttpError } from '../../lib/http-error.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { RajaOngkirError, fetchDistrictRates, type CourierRate } from '../../lib/rajaongkir.js';
import { redis } from '../../lib/redis.js';

export interface ShippingQuoteRequest {
  destinationDistrictId: number;
  weightGram: number;
  courier: string;
  service: string;
}

export interface ShippingQuote {
  /** Kode kurir, mis. "jne". */
  courier: string;
  courierName: string;
  /** Kode layanan, mis. "REG". */
  service: string;
  description: string;
  /** Rupiah. */
  cost: number;
  /** Estimasi hari, teks dari kurir (mis. "2-3 day"). */
  etd: string;
}

export type QuoteShipping = (request: ShippingQuoteRequest) => Promise<ShippingQuote>;

export function shippingUnavailable(message: string, status = 400): HttpError {
  return new HttpError(status, ErrorCode.SHIPPING_UNAVAILABLE, message);
}

/**
 * Kode kurir yang diterima RajaOngkir untuk ongkir domestik. Diambil dari pesan validasi
 * API (1 Okt 2026), bukan dari dokumentasi: dokumentasi masih mencantumkan "dse" yang
 * sudah ditolak, dan belum mencantumkan "spx".
 */
export const SUPPORTED_COURIERS = [
  'jne',
  'jnt',
  'sicepat',
  'anteraja',
  'pos',
  'tiki',
  'ninja',
  'lion',
  'ide',
  'sap',
  'ncs',
  'rex',
  'rpx',
  'sentral',
  'star',
  'wahana',
  'spx',
] as const;

/**
 * Layanan kargo/truk untuk paket besar (biasanya minimal 10 kg). Produk toko kecil dan ringan,
 * jadi layanan ini tidak ditawarkan walau kurirnya aktif (keputusan 1 Okt 2026).
 */
const CARGO_SERVICE_PATTERN = /cargo|kargo|truck|trucking|\bjtr\b|gokil/i;

export function isCargoService(quote: { service: string; description: string }): boolean {
  return CARGO_SERVICE_PATTERN.test(quote.service) || CARGO_SERVICE_PATTERN.test(quote.description);
}

export const SETTING_KEYS = {
  originDistrictId: 'shipping.originDistrictId',
  couriers: 'shipping.couriers',
} as const;

const shippingSettingsSchema = z.object({
  originDistrictId: z.number().int().positive(),
  couriers: z.array(z.enum(SUPPORTED_COURIERS)).min(1),
});

export type ShippingSettings = z.infer<typeof shippingSettingsSchema>;

/** Alamat asal dan kurir aktif dari pengaturan toko (F-13, F-23). */
export async function getShippingSettings(): Promise<ShippingSettings> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: Object.values(SETTING_KEYS) } },
  });
  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  const parsed = shippingSettingsSchema.safeParse({
    originDistrictId: byKey.get(SETTING_KEYS.originDistrictId),
    couriers: byKey.get(SETTING_KEYS.couriers),
  });
  if (!parsed.success) {
    logger.error({ issues: parsed.error.issues }, 'Pengaturan pengiriman belum lengkap');
    throw shippingUnavailable('Pengiriman belum diatur oleh toko.', 503);
  }
  return parsed.data;
}

function toQuote(rate: CourierRate): ShippingQuote {
  return {
    courier: rate.code,
    courierName: rate.name,
    service: rate.service,
    description: rate.description,
    cost: rate.cost,
    etd: rate.etd,
  };
}

/** Key cache sesuai CLAUDE.md: ongkir:{origin}:{dest}:{weight}:{courier}. */
export function shippingCacheKey(
  origin: number,
  destination: number,
  weightGram: number,
  couriers: readonly string[],
): string {
  return `ongkir:${origin}:${destination}:${weightGram}:${[...couriers].sort().join(',')}`;
}

async function readCache(key: string): Promise<ShippingQuote[] | null> {
  try {
    const cached = await redis.get(key);
    return cached ? (JSON.parse(cached) as ShippingQuote[]) : null;
  } catch (err) {
    // Redis bermasalah tidak boleh menghentikan checkout; langsung tanya RajaOngkir.
    logger.warn({ err }, 'Cache ongkir tidak bisa dibaca');
    return null;
  }
}

async function writeCache(key: string, quotes: ShippingQuote[]): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(quotes), 'EX', CACHE_TTL.SHIPPING_COST);
  } catch (err) {
    logger.warn({ err }, 'Cache ongkir tidak bisa ditulis');
  }
}

/** Semua layanan dari kurir aktif, termurah dulu. Hasil di-cache 24 jam. */
export async function getShippingRates(
  destinationDistrictId: number,
  weightGram: number,
): Promise<ShippingQuote[]> {
  if (!Number.isInteger(weightGram) || weightGram <= 0) {
    throw shippingUnavailable('Berat paket tidak valid');
  }
  const settings = await getShippingSettings();
  const key = shippingCacheKey(
    settings.originDistrictId,
    destinationDistrictId,
    weightGram,
    settings.couriers,
  );

  const cached = await readCache(key);
  if (cached) return cached;

  let rates: CourierRate[];
  try {
    rates = await fetchDistrictRates({
      originDistrictId: settings.originDistrictId,
      destinationDistrictId,
      weightGram,
      couriers: settings.couriers,
    });
  } catch (err) {
    if (err instanceof RajaOngkirError) {
      throw shippingUnavailable(
        err.isTemporary
          ? 'Ongkir sedang tidak bisa dihitung. Coba lagi beberapa saat lagi.'
          : 'Ongkir ke alamat ini tidak bisa dihitung. Periksa kecamatan tujuan.',
        err.isTemporary ? 503 : 400,
      );
    }
    throw err;
  }

  const allowed = new Set<string>(settings.couriers);
  const quotes = rates
    .filter((rate) => allowed.has(rate.code))
    .map(toQuote)
    .filter((quote) => !isCargoService(quote))
    .sort((a, b) => a.cost - b.cost);
  // Hasil kosong tidak di-cache agar alamat yang baru bisa dilayani bisa dicoba lagi.
  if (quotes.length > 0) await writeCache(key, quotes);
  return quotes;
}

/** Ongkir satu layanan yang dipilih pembeli, selalu dihitung ulang di server. */
export const quoteShipping: QuoteShipping = async (request) => {
  const quotes = await getShippingRates(request.destinationDistrictId, request.weightGram);
  const match = quotes.find(
    (quote) =>
      quote.courier === request.courier.toLowerCase() &&
      quote.service.toUpperCase() === request.service.toUpperCase(),
  );
  if (!match) {
    throw shippingUnavailable('Layanan kurir yang dipilih tidak tersedia. Pilih ulang kurir.');
  }
  return match;
};
