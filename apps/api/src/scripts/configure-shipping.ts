/**
 * Atur alamat asal pengiriman dan kurir aktif (sampai halaman pengaturan owner dibuat di M4).
 *
 *   pnpm --filter api shipping:configure -- --search bandung        # cari kota (tanpa hit)
 *   pnpm --filter api shipping:configure -- --city 23               # daftar kecamatan (maks. 1 hit)
 *   pnpm --filter api shipping:configure -- --origin-district 1001 --couriers jne,jnt,sicepat
 *   pnpm --filter api shipping:configure                             # tampilkan pengaturan saat ini
 */
import { parseArgs } from 'node:util';
import { prisma } from '../lib/prisma.js';
import { listDistricts, titleCase } from '../modules/shipping/region.service.js';
import { SETTING_KEYS, SUPPORTED_COURIERS } from '../modules/shipping/shipping.service.js';

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: {
    search: { type: 'string' },
    city: { type: 'string' },
    'origin-district': { type: 'string' },
    couriers: { type: 'string' },
  },
});

async function showCurrent() {
  const rows = await prisma.setting.findMany({
    where: { key: { in: Object.values(SETTING_KEYS) } },
  });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const originId = byKey.get(SETTING_KEYS.originDistrictId);
  const origin =
    typeof originId === 'number'
      ? await prisma.district.findUnique({
          where: { id: originId },
          include: { city: { include: { province: true } } },
        })
      : null;
  console.log(
    'Asal pengiriman:',
    origin
      ? `${titleCase(origin.name)}, ${titleCase(origin.city.name)}, ${titleCase(origin.city.province.name)} (id ${origin.id})`
      : 'belum diatur',
  );
  console.log(
    'Kurir aktif    :',
    JSON.stringify(byKey.get(SETTING_KEYS.couriers) ?? 'belum diatur'),
  );
}

async function main() {
  if (values.search) {
    const cities = await prisma.city.findMany({
      where: { name: { contains: values.search, mode: 'insensitive' } },
      include: { province: true },
      orderBy: { name: 'asc' },
    });
    if (cities.length === 0) console.log('Kota tidak ditemukan. Sudah menjalankan region:sync?');
    for (const c of cities) {
      console.log(
        `${String(c.id).padStart(5)}  ${titleCase(c.name)}, ${titleCase(c.province.name)}`,
      );
    }
    return;
  }

  if (values.city) {
    const districts = await listDistricts(Number(values.city));
    for (const d of districts) {
      console.log(
        `${String(d.id).padStart(6)}  ${d.name}${d.postalCode ? ` (${d.postalCode})` : ''}`,
      );
    }
    return;
  }

  const originRaw = values['origin-district'];
  const couriersRaw = values.couriers;
  if (originRaw || couriersRaw) {
    if (!originRaw || !couriersRaw) {
      throw new Error('Isi --origin-district dan --couriers sekaligus');
    }
    const originId = Number(originRaw);
    const district = await prisma.district.findUnique({ where: { id: originId } });
    if (!district) {
      throw new Error(`Kecamatan ${originRaw} tidak ada. Tampilkan dulu dengan --city <id kota>.`);
    }
    const couriers = couriersRaw
      .split(',')
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean);
    const unknown = couriers.filter((c) => !(SUPPORTED_COURIERS as readonly string[]).includes(c));
    if (unknown.length > 0 || couriers.length === 0) {
      throw new Error(
        `Kurir tidak dikenal: ${unknown.join(', ') || '(kosong)'}. Pilihan: ${SUPPORTED_COURIERS.join(', ')}`,
      );
    }
    await prisma.$transaction([
      prisma.setting.upsert({
        where: { key: SETTING_KEYS.originDistrictId },
        create: { key: SETTING_KEYS.originDistrictId, value: originId },
        update: { value: originId },
      }),
      prisma.setting.upsert({
        where: { key: SETTING_KEYS.couriers },
        create: { key: SETTING_KEYS.couriers, value: couriers },
        update: { value: couriers },
      }),
    ]);
    console.log('Pengaturan pengiriman disimpan.');
  }

  await showCurrent();
}

main()
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
