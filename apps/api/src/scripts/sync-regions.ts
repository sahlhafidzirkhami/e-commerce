/**
 * Sinkron data wilayah dari RajaOngkir ke database.
 *
 *   pnpm --filter api region:sync               # provinsi + kota (~35 hit)
 *   pnpm --filter api region:sync -- --districts # + semua kecamatan (~550 hit, butuh paket Pro)
 *
 * Paket Starter (100 hit/hari): jalankan tanpa --districts. Kecamatan diambil per kota
 * saat pertama kali dipakai di checkout.
 */
import { parseArgs } from 'node:util';
import { prisma } from '../lib/prisma.js';
import { RajaOngkirError, fetchCities, fetchDistricts, fetchProvinces } from '../lib/rajaongkir.js';

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: { districts: { type: 'boolean', default: false } },
});

let hits = 0;

async function main() {
  const provinces = await fetchProvinces();
  hits++;
  for (const p of provinces) {
    await prisma.province.upsert({
      where: { id: p.id },
      create: { id: p.id, name: p.name },
      update: { name: p.name },
    });
  }
  console.log(`Provinsi: ${provinces.length}`);

  let cityCount = 0;
  const cityIds: number[] = [];
  for (const p of provinces) {
    const cities = await fetchCities(p.id);
    hits++;
    for (const c of cities) {
      await prisma.city.upsert({
        where: { id: c.id },
        create: { id: c.id, provinceId: p.id, name: c.name },
        update: { provinceId: p.id, name: c.name },
      });
      cityIds.push(c.id);
    }
    cityCount += cities.length;
    process.stdout.write(`\rKota: ${cityCount} (provinsi ${hits - 1}/${provinces.length})`);
  }
  console.log();

  if (values.districts) {
    let districtCount = 0;
    for (const [index, cityId] of cityIds.entries()) {
      const districts = await fetchDistricts(cityId);
      hits++;
      for (const d of districts) {
        await prisma.district.upsert({
          where: { id: d.id },
          create: { id: d.id, cityId, name: d.name, postalCode: d.zipCode },
          update: { cityId, name: d.name, postalCode: d.zipCode },
        });
      }
      districtCount += districts.length;
      process.stdout.write(`\rKecamatan: ${districtCount} (kota ${index + 1}/${cityIds.length})`);
    }
    console.log();
  }
}

main()
  .then(() => console.log(`Selesai. Hit RajaOngkir terpakai: ${hits}.`))
  .catch((err: unknown) => {
    const message = err instanceof RajaOngkirError ? `${err.status} ${err.message}` : String(err);
    console.error(`\nGagal setelah ${hits} hit: ${message}`);
    console.error('Data yang sudah tersimpan aman; jalankan ulang besok bila kuota habis.');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
