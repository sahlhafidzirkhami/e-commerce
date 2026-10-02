import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { logger } from './logger.js';

export interface StorageDriver {
  /** Simpan file lalu kembalikan URL publiknya. */
  put(key: string, data: Buffer, contentType: string): Promise<string>;
  /** Hapus file milik storage ini dari URL publiknya. URL dari tempat lain diabaikan. */
  remove(url: string): Promise<void>;
}

/** Folder upload lokal. Default: apps/api/uploads (sama untuk src/ maupun dist/). */
export const uploadsDir = env.UPLOADS_DIR
  ? path.resolve(env.UPLOADS_DIR)
  : fileURLToPath(new URL('../../uploads/', import.meta.url));

const publicPrefix = `${env.API_URL}/uploads/`;

/** Path file di disk, atau null bila URL bukan milik storage ini / mencoba keluar folder upload. */
function localPathOf(url: string): string | null {
  if (!url.startsWith(publicPrefix)) return null;
  const target = path.resolve(uploadsDir, ...url.slice(publicPrefix.length).split('/'));
  return target.startsWith(path.resolve(uploadsDir) + path.sep) ? target : null;
}

/** Driver development: file disimpan di disk dan disajikan API di /uploads. */
const localStorage: StorageDriver = {
  async put(key, data) {
    const target = path.join(uploadsDir, ...key.split('/'));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
    return `${publicPrefix}${key}`;
  },
  async remove(url) {
    const target = localPathOf(url);
    if (!target) return;
    try {
      await rm(target, { force: true });
    } catch (err) {
      // Data di database sudah terhapus; file yang tertinggal tidak boleh menggagalkan request.
      logger.warn({ err, url }, 'File upload gagal dihapus dari disk');
    }
  },
};

// Driver object storage (S3/R2) ditambahkan setelah layanan dipilih.
export const storage: StorageDriver = localStorage;
