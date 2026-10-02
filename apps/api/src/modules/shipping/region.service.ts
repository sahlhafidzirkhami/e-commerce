import { ErrorCode } from '@sportswear/shared';
import { HttpError } from '../../lib/http-error.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { RajaOngkirError, fetchDistricts } from '../../lib/rajaongkir.js';

export interface RegionOption {
  id: number;
  name: string;
}

export interface DistrictOption extends RegionOption {
  postalCode: string | null;
}

/** Nama dari RajaOngkir huruf kapital semua; tampilkan dengan huruf awal kapital. */
export function titleCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/(^|[\s(/-])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase())
    .replace(/\b(Dki|Ntb|Ntt|Di)\b/g, (word) => word.toUpperCase());
}

function notSynced(): HttpError {
  return new HttpError(
    503,
    ErrorCode.SHIPPING_UNAVAILABLE,
    'Data wilayah belum tersedia. Coba lagi nanti.',
  );
}

export async function listProvinces(): Promise<RegionOption[]> {
  const provinces = await prisma.province.findMany({ orderBy: { name: 'asc' } });
  if (provinces.length === 0) throw notSynced();
  return provinces.map((p) => ({ id: p.id, name: titleCase(p.name) }));
}

export async function listCities(provinceId: number): Promise<RegionOption[]> {
  const cities = await prisma.city.findMany({ where: { provinceId }, orderBy: { name: 'asc' } });
  return cities.map((c) => ({ id: c.id, name: titleCase(c.name) }));
}

// Permintaan bersamaan untuk kota yang sama cukup memakai satu hit RajaOngkir.
const pendingDistrictSync = new Map<number, Promise<void>>();

async function syncDistrictsOfCity(cityId: number): Promise<void> {
  const districts = await fetchDistricts(cityId);
  await prisma.$transaction(
    districts.map((d) =>
      prisma.district.upsert({
        where: { id: d.id },
        create: { id: d.id, cityId, name: d.name, postalCode: d.zipCode },
        update: { cityId, name: d.name, postalCode: d.zipCode },
      }),
    ),
  );
  logger.info({ cityId, count: districts.length }, 'Kecamatan disinkron dari RajaOngkir');
}

/**
 * Kecamatan diambil dari database. Bila kota ini belum pernah disinkron, ambil sekali dari
 * RajaOngkir lalu simpan (paket Starter tidak cukup untuk menyinkron semua kecamatan sekaligus).
 */
export async function listDistricts(cityId: number): Promise<DistrictOption[]> {
  const city = await prisma.city.findUnique({ where: { id: cityId }, select: { id: true } });
  if (!city) throw HttpError.notFound('Kota tidak ditemukan');

  let districts = await prisma.district.findMany({ where: { cityId }, orderBy: { name: 'asc' } });
  if (districts.length === 0) {
    let pending = pendingDistrictSync.get(cityId);
    if (!pending) {
      pending = syncDistrictsOfCity(cityId).finally(() => pendingDistrictSync.delete(cityId));
      pendingDistrictSync.set(cityId, pending);
    }
    try {
      await pending;
    } catch (err) {
      if (err instanceof RajaOngkirError) throw notSynced();
      throw err;
    }
    districts = await prisma.district.findMany({ where: { cityId }, orderBy: { name: 'asc' } });
  }

  return districts.map((d) => ({ id: d.id, name: titleCase(d.name), postalCode: d.postalCode }));
}
