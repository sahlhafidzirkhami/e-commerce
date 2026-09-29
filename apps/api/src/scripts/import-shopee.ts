/**
 * Import produk dari export "Update Massal" Shopee.
 *
 *   pnpm --filter api import:shopee -- --dry-run        # validasi saja
 *   pnpm --filter api import:shopee                     # import sungguhan
 *   pnpm --filter api import:shopee -- --update-stock   # ikut menimpa stok varian yang sudah ada
 *   pnpm --filter api import:shopee -- --dir <folder>   # default: <root>/data-import
 */
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { prisma } from '../lib/prisma.js';
import { storage } from '../lib/storage.js';
import { readShopeeSheet } from '../modules/product/shopee-import/excel.js';
import { importProducts } from '../modules/product/shopee-import/importer.js';
import { transformShopeeExport } from '../modules/product/shopee-import/transform.js';

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: {
    dir: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    'update-stock': { type: 'boolean', default: false },
  },
});

const dir = values.dir
  ? path.resolve(values.dir)
  : fileURLToPath(new URL('../../../../data-import/', import.meta.url));
const dryRun = values['dry-run'];
const updateStock = values['update-stock'];

async function latestFile(prefix: string): Promise<string> {
  const files = (await readdir(dir))
    .filter((file) => file.startsWith(prefix) && file.endsWith('.xlsx'))
    .sort();
  const latest = files.at(-1);
  if (!latest) throw new Error(`File ${prefix}*.xlsx tidak ditemukan di ${dir}`);
  return path.join(dir, latest);
}

async function main() {
  console.log(`Folder: ${dir}`);
  console.log(`Mode  : ${dryRun ? 'DRY RUN (tidak menulis apa pun)' : 'IMPORT'}`);
  console.log(
    `Stok  : ${updateStock ? 'ditimpa untuk varian yang sudah ada' : 'hanya untuk varian baru'}\n`,
  );

  const [basic, media, sales, shipping] = await Promise.all(
    [
      'mass_update_basic_info_',
      'mass_update_media_info_',
      'mass_update_sales_info_',
      'mass_update_shipping_info_',
    ].map(async (prefix) => readShopeeSheet(await latestFile(prefix))),
  );

  const { products, skipped, warnings } = transformShopeeExport({
    basic: basic ?? [],
    media: media ?? [],
    sales: sales ?? [],
    shipping: shipping ?? [],
  });
  console.log(
    `Produk siap: ${products.length} (${products.reduce((n, p) => n + p.variants.length, 0)} varian) | dilewati: ${skipped.length}\n`,
  );

  const report = await importProducts(products, {
    dryRun,
    updateStock,
    storage,
    onProgress: (message) => console.log(message),
  });

  console.log('\n══════ Laporan ══════');
  if (!dryRun) {
    console.log(`Produk baru     : ${report.created.length}`);
    console.log(`Produk diupdate : ${report.updated.length}`);
    console.log(`Varian baru     : ${report.variantsCreated}`);
    console.log(`Varian diupdate : ${report.variantsUpdated}`);
    console.log(`Foto disimpan   : ${report.imagesSaved}`);
  }
  console.log(`\nDilewati (${skipped.length}):`);
  for (const s of skipped) console.log(`  - ${s.name.slice(0, 60)} → ${s.reason}`);
  const allWarnings = [...warnings, ...report.warnings];
  console.log(`\nPeringatan (${allWarnings.length}):`);
  for (const w of allWarnings) console.log(`  - ${w}`);
  console.log(`\nGagal (${report.failed.length}):`);
  for (const f of report.failed) console.log(`  - ${f.sku}: ${f.reason}`);

  if (report.failed.length > 0) process.exitCode = 1;
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
