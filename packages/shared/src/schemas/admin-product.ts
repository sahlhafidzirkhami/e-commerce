import { z } from 'zod';
import { SIZE_ORDER } from '../catalog.js';

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z.string().trim().max(max).nullable(),
  );

const cm = z.number().int('Ukuran paket harus bilangan bulat (cm)').min(1).max(200).nullable();

const rupiah = (label: string) =>
  z.number().int(`${label} harus Rupiah bulat`).min(1, `${label} minimal Rp1`);

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Slug minimal 3 karakter')
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug hanya huruf kecil, angka, dan tanda hubung');

/** Data produk yang bisa diubah admin. SKU induk tidak termasuk: tetap setelah dibuat. */
export const productUpdateSchema = z.object({
  name: z.string().trim().min(3, 'Nama minimal 3 karakter').max(200),
  slug: slugSchema,
  categoryId: z.string().min(1).nullable(),
  description: z.string().trim().max(10_000),
  seoTitle: optionalText(200),
  brand: optionalText(60),
  gender: optionalText(30),
  sportType: optionalText(60),
  motif: optionalText(60),
  sleeveLength: optionalText(30),
  lengthCm: cm,
  widthCm: cm,
  heightCm: cm,
  isActive: z.boolean(),
});

export const variantCreateSchema = z.object({
  size: z.enum(SIZE_ORDER as [string, ...string[]], { error: 'Ukuran tidak dikenal' }),
  price: rupiah('Harga'),
  stock: z.number().int('Stok harus bilangan bulat').min(0, 'Stok tidak boleh negatif'),
  weightGram: z.number().int('Berat harus bilangan bulat (gram)').min(1, 'Berat minimal 1 gram'),
});

export const productCreateSchema = productUpdateSchema
  .omit({ slug: true })
  .extend({
    /** SKU induk, mis. MSL001-3 (kode model + nomor warna). */
    sku: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/, 'SKU hanya huruf, angka, dan tanda hubung')
      .max(40),
    slug: slugSchema.optional(),
    variants: z.array(variantCreateSchema).min(1, 'Isi minimal satu ukuran'),
  })
  .refine((p) => new Set(p.variants.map((v) => v.size)).size === p.variants.length, {
    message: 'Ukuran tidak boleh dobel',
    path: ['variants'],
  });

export const variantUpdateSchema = z.object({
  price: rupiah('Harga'),
  weightGram: z.number().int().min(1, 'Berat minimal 1 gram'),
  isActive: z.boolean(),
});

/**
 * Ubah stok dengan pengaman: `expected` = stok yang dilihat admin. Bila checkout mengubah
 * stok di saat yang sama, perubahan ditolak agar tidak menimpa pengurangan dari order.
 */
export const stockUpdateSchema = z.object({
  expected: z.number().int().min(0),
  stock: z.number().int('Stok harus bilangan bulat').min(0, 'Stok tidak boleh negatif'),
});

export const imageOrderSchema = z.object({ imageIds: z.array(z.string().min(1)).min(1) });

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2, 'Nama kategori minimal 2 karakter').max(60),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(999),
});

export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type VariantCreateInput = z.infer<typeof variantCreateSchema>;
export type VariantUpdateInput = z.infer<typeof variantUpdateSchema>;
export type StockUpdateInput = z.infer<typeof stockUpdateSchema>;
export type CategoryInput = z.infer<typeof categoryInputSchema>;

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  sortOrder: number;
  productCount: number;
}

export interface AdminVariant {
  id: string;
  sku: string;
  size: string;
  price: number;
  stock: number;
  weightGram: number;
  isActive: boolean;
}

export interface AdminProductSummary {
  id: string;
  sku: string;
  name: string;
  slug: string;
  isActive: boolean;
  category: { id: string; name: string } | null;
  imageUrl: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  totalStock: number;
  /** Ringkas: ukuran aktif beserta stoknya. */
  variants: { size: string; stock: number; isActive: boolean }[];
}

export interface AdminProductListResult {
  items: AdminProductSummary[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AdminProductDetail extends ProductUpdateInput {
  id: string;
  sku: string;
  sizeChartUrl: string | null;
  images: { id: string; url: string; alt: string | null }[];
  /** Termasuk ukuran nonaktif. Ukuran tidak pernah dihapus agar riwayat order utuh. */
  variants: AdminVariant[];
}
