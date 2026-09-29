import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';

export interface StorageDriver {
  /** Simpan file lalu kembalikan URL publiknya. */
  put(key: string, data: Buffer, contentType: string): Promise<string>;
}

/** Folder upload lokal. Default: apps/api/uploads (sama untuk src/ maupun dist/). */
export const uploadsDir = env.UPLOADS_DIR
  ? path.resolve(env.UPLOADS_DIR)
  : fileURLToPath(new URL('../../uploads/', import.meta.url));

/** Driver development: file disimpan di disk dan disajikan API di /uploads. */
const localStorage: StorageDriver = {
  async put(key, data) {
    const target = path.join(uploadsDir, ...key.split('/'));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
    return `${env.API_URL}/uploads/${key}`;
  },
};

// Driver object storage (S3/R2) ditambahkan setelah layanan dipilih.
export const storage: StorageDriver = localStorage;
