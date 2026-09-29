import ExcelJS from 'exceljs';
import type { SheetRecord } from './transform.js';

type CellValue = ExcelJS.CellValue;

function cellText(value: CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if ('richText' in value) return value.richText.map((part) => part.text).join('');
  if ('text' in value && typeof value.text === 'string') return value.text;
  if ('result' in value) return cellText(value.result as CellValue);
  return '';
}

/**
 * Membaca sheet pertama export Shopee. Baris 1 = kode header teknis
 * (mis. `et_title_product_id`); baris data = baris yang kolom pertamanya angka (Kode Produk).
 */
export async function readShopeeSheet(path: string): Promise<SheetRecord[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error(`Sheet tidak ditemukan: ${path}`);

  const headers: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = cellText(cell.value).trim();
  });

  const records: SheetRecord[] = [];
  sheet.eachRow((row) => {
    const firstCell = cellText(row.getCell(1).value).trim();
    if (!/^\d+$/.test(firstCell)) return;

    const record: SheetRecord = {};
    headers.forEach((header, col) => {
      if (header) record[header] = cellText(row.getCell(col).value).trim();
    });
    records.push(record);
  });
  return records;
}
