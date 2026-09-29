import sharp from 'sharp';

export const IMAGE_MAX_DIMENSION = 1200;

export interface ProcessedImage {
  data: Buffer;
  /** Dimensi foto asli, untuk cek rasio cover. */
  sourceWidth: number;
  sourceHeight: number;
}

export async function downloadImage(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Gagal mengunduh ${url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Konversi ke WebP, maksimal 1200 px sisi terpanjang, tanpa memperbesar foto kecil. */
export async function toWebp(input: Buffer): Promise<ProcessedImage> {
  const image = sharp(input).rotate();
  const meta = await image.metadata();
  const data = await image
    .resize({
      width: IMAGE_MAX_DIMENSION,
      height: IMAGE_MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 80 })
    .toBuffer();
  return { data, sourceWidth: meta.width ?? 0, sourceHeight: meta.height ?? 0 };
}

export function isSquare(image: ProcessedImage): boolean {
  return image.sourceWidth > 0 && image.sourceWidth === image.sourceHeight;
}
