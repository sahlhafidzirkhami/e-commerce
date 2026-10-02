/**
 * Satu-satunya client RajaOngkir (Komerce, API V2 sejak Juli 2025).
 * Dokumentasi: https://rajaongkir.com/docs/shipping-cost
 * Paket Starter = 100 hit/hari: setiap fungsi di sini memakai 1 hit, jadi selalu
 * simpan ke database atau cache sebelum memanggilnya lagi.
 */
import { env } from '../config/env.js';
import { logger } from './logger.js';

const DEFAULT_BASE_URL = 'https://rajaongkir.komerce.id/api/v1';
const TIMEOUT_MS = 10_000;
/** Hitung ongkir 15 kurir sekaligus terukur ~10 detik (1 Okt 2026); beri ruang. */
const RATES_TIMEOUT_MS = 30_000;

export class RajaOngkirError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'RajaOngkirError';
  }

  /** Kuota habis, timeout, atau RajaOngkir tidak bisa dihubungi: coba lagi nanti. */
  get isTemporary(): boolean {
    return this.status === 429 || this.status >= 500;
  }
}

interface Envelope<T> {
  meta?: { message?: string; code?: number; status?: string };
  data?: T | null;
}

export interface RegionItem {
  id: number;
  name: string;
  /** Kode pos; "0" dari API berarti tidak ada, diubah menjadi null. */
  zipCode: string | null;
}

export interface CourierRate {
  /** Nama kurir, mis. "Jalur Nugraha Ekakurir (JNE)". */
  name: string;
  /** Kode kurir, mis. "jne". */
  code: string;
  service: string;
  description: string;
  cost: number;
  etd: string;
}

function config() {
  const key = env.RAJAONGKIR_API_KEY;
  if (!key) throw new RajaOngkirError(503, 'RAJAONGKIR_API_KEY belum diisi');
  return { key, baseUrl: (env.RAJAONGKIR_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, '') };
}

async function request<T>(
  path: string,
  form?: Record<string, string>,
  timeoutMs = TIMEOUT_MS,
): Promise<T> {
  const { key, baseUrl } = config();
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method: form ? 'POST' : 'GET',
      headers: {
        key,
        accept: 'application/json',
        ...(form && { 'content-type': 'application/x-www-form-urlencoded' }),
      },
      ...(form && { body: new URLSearchParams(form).toString() }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    logger.warn(
      { path, reason: err instanceof Error ? err.name : String(err) },
      'RajaOngkir tidak bisa dihubungi',
    );
    throw new RajaOngkirError(503, 'RajaOngkir tidak bisa dihubungi');
  }

  const body = (await res.json().catch(() => null)) as Envelope<T> | null;
  const code = body?.meta?.code ?? res.status;
  if (!res.ok || code >= 400 || body?.data === undefined || body.data === null) {
    const message = body?.meta?.message ?? `HTTP ${res.status}`;
    logger.warn({ path, status: res.status, code, message }, 'RajaOngkir menolak permintaan');
    throw new RajaOngkirError(res.ok ? code : res.status, message);
  }
  return body.data;
}

function toRegion(item: { id: number; name: string; zip_code?: string | null }): RegionItem {
  const zip = item.zip_code?.trim();
  return { id: item.id, name: item.name, zipCode: zip && zip !== '0' ? zip : null };
}

type RawRegion = { id: number; name: string; zip_code?: string | null };

export async function fetchProvinces(): Promise<RegionItem[]> {
  return (await request<RawRegion[]>('/destination/province')).map(toRegion);
}

export async function fetchCities(provinceId: number): Promise<RegionItem[]> {
  return (await request<RawRegion[]>(`/destination/city/${provinceId}`)).map(toRegion);
}

export async function fetchDistricts(cityId: number): Promise<RegionItem[]> {
  return (await request<RawRegion[]>(`/destination/district/${cityId}`)).map(toRegion);
}

/** Ongkir antar kecamatan untuk beberapa kurir sekaligus (1 hit). */
export async function fetchDistrictRates(params: {
  originDistrictId: number;
  destinationDistrictId: number;
  weightGram: number;
  couriers: readonly string[];
}): Promise<CourierRate[]> {
  const data = await request<
    {
      name: string;
      code: string;
      service: string;
      description?: string;
      cost: number;
      etd?: string;
    }[]
  >(
    '/calculate/district/domestic-cost',
    {
      origin: String(params.originDistrictId),
      destination: String(params.destinationDistrictId),
      weight: String(Math.max(1, Math.round(params.weightGram))),
      courier: params.couriers.join(':'),
    },
    RATES_TIMEOUT_MS,
  );
  return data
    .filter((rate) => Number.isInteger(rate.cost) && rate.cost > 0)
    .map((rate) => ({
      name: rate.name,
      code: rate.code.toLowerCase(),
      service: rate.service,
      description: rate.description ?? '',
      cost: rate.cost,
      etd: rate.etd ?? '',
    }));
}
