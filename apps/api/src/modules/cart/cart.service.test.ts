import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import { HttpError } from '../../lib/http-error.js';
import {
  assertQuantityAvailable,
  buildCartView,
  resolveCart,
  type CartItemRecord,
} from './cart.service.js';

interface FakeCart {
  id: string;
  token: string;
  userId: string | null;
}
interface FakeItem {
  id: string;
  cartId: string;
  variantId: string;
  quantity: number;
  createdAt: Date;
}
interface FakeVariant {
  id: string;
  sku: string;
  size: string;
  price: number;
  stock: number;
  isActive: boolean;
}

// Database tiruan di memori — cukup untuk query yang dipakai modul cart.
const db = vi.hoisted(() => ({
  carts: [] as FakeCart[],
  items: [] as FakeItem[],
  variants: [] as FakeVariant[],
  seq: 0,
}));

vi.mock('../../lib/prisma.js', () => {
  const withCount = (cart: FakeCart | undefined) =>
    cart
      ? { ...cart, _count: { items: db.items.filter((i) => i.cartId === cart.id).length } }
      : null;
  const deleteCart = (id: string) => {
    db.carts = db.carts.filter((c) => c.id !== id);
    db.items = db.items.filter((i) => i.cartId !== id);
  };
  const findItem = (key: { cartId: string; variantId: string }) =>
    db.items.find((i) => i.cartId === key.cartId && i.variantId === key.variantId);

  const prisma = {
    cart: {
      findFirst: vi.fn(async ({ where }: { where: { token: string } }) =>
        withCount(db.carts.find((c) => c.token === where.token && c.userId === null)),
      ),
      findUnique: vi.fn(async ({ where }: { where: { userId: string } }) =>
        withCount(db.carts.find((c) => c.userId === where.userId)),
      ),
      create: vi.fn(async ({ data }: { data: Omit<FakeCart, 'id'> }) => {
        const cart = { id: `cart-${++db.seq}`, ...data };
        db.carts.push(cart);
        return cart;
      }),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: { userId: string } }) => {
          const cart = db.carts.find((c) => c.id === where.id)!;
          cart.userId = data.userId;
          return { ...cart };
        },
      ),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => deleteCart(where.id)),
    },
    cartItem: {
      findUnique: vi.fn(
        async ({ where }: { where: { cartId_variantId: { cartId: string; variantId: string } } }) =>
          findItem(where.cartId_variantId) ?? null,
      ),
      upsert: vi.fn(
        async (args: {
          where: { cartId_variantId: { cartId: string; variantId: string } };
          create: { cartId: string; variantId: string; quantity: number };
          update: { quantity: number };
        }) => {
          const item = findItem(args.where.cartId_variantId);
          if (item) item.quantity = args.update.quantity;
          else db.items.push({ id: `item-${++db.seq}`, createdAt: new Date(), ...args.create });
        },
      ),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: { quantity: number } }) => {
          db.items.find((i) => i.id === where.id)!.quantity = data.quantity;
        },
      ),
      deleteMany: vi.fn(async ({ where }: { where: { cartId: string; variantId: string } }) => {
        db.items = db.items.filter(
          (i) => !(i.cartId === where.cartId && i.variantId === where.variantId),
        );
      }),
      findMany: vi.fn(async ({ where }: { where: { cartId: string } }) =>
        db.items
          .filter((i) => i.cartId === where.cartId)
          .map((i) => {
            const v = db.variants.find((x) => x.id === i.variantId)!;
            return {
              ...i,
              variant: {
                ...v,
                product: {
                  slug: 'kaos-lari',
                  name: 'Kaos Lari',
                  isActive: true,
                  category: { isActive: true },
                  images: [],
                },
              },
            };
          }),
      ),
    },
    productVariant: {
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) => {
        const v = db.variants.find((x) => x.id === where.id && x.isActive);
        return v ? { id: v.id, size: v.size, stock: v.stock } : null;
      }),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
  };
  return { prisma };
});

beforeEach(() => {
  db.carts = [];
  db.items = [];
  db.seq = 0;
  db.variants = [
    { id: 'v-m', sku: 'TSS001-1-M', size: 'M', price: 125000, stock: 3, isActive: true },
    { id: 'v-l', sku: 'TSS001-1-L', size: 'L', price: 125000, stock: 0, isActive: true },
    { id: 'v-off', sku: 'TSS001-1-XL', size: 'XL', price: 125000, stock: 5, isActive: false },
  ];
});

function record(
  quantity: number,
  variant: Partial<CartItemRecord['variant']> = {},
  productActive = true,
): CartItemRecord {
  return {
    id: 'i1',
    cartId: 'c1',
    variantId: 'v1',
    quantity,
    createdAt: new Date(),
    updatedAt: new Date(),
    variant: {
      sku: 'SKU-M',
      size: 'M',
      price: 100000,
      stock: 5,
      isActive: true,
      product: {
        slug: 'kaos',
        name: 'Kaos',
        isActive: productActive,
        category: { isActive: true },
        images: [{ url: 'https://cdn/a.webp', alt: null }],
      },
      ...variant,
    },
  };
}

describe('buildCartView', () => {
  it('menghitung subtotal dari harga varian saat ini', () => {
    const view = buildCartView([record(2), record(1, { price: 50000 })]);
    expect(view.subtotal).toBe(250000);
    expect(view.itemCount).toBe(3);
    expect(view.hasIssues).toBe(false);
    expect(view.items[0]?.image).toEqual({ url: 'https://cdn/a.webp', alt: 'Kaos' });
  });

  it('menandai item bermasalah dan tidak menghitungnya di subtotal', () => {
    const view = buildCartView([
      record(1),
      record(4, { stock: 2 }),
      record(1, { stock: 0 }),
      record(1, { isActive: false }),
      record(1, {}, false),
    ]);
    expect(view.items.map((i) => i.issue)).toEqual([
      null,
      'INSUFFICIENT_STOCK',
      'OUT_OF_STOCK',
      'UNAVAILABLE',
      'UNAVAILABLE',
    ]);
    expect(view.subtotal).toBe(100000);
    expect(view.hasIssues).toBe(true);
    expect(view.items[3]?.stock).toBe(0);
  });
});

describe('assertQuantityAvailable', () => {
  const messageOf = (fn: () => void) => {
    try {
      fn();
    } catch (err) {
      return err instanceof HttpError ? `${err.status} ${err.message}` : 'bukan HttpError';
    }
    return 'tidak error';
  };

  it('lolos bila jumlah tidak melebihi stok', () => {
    expect(messageOf(() => assertQuantityAvailable(3, 3, 'M'))).toBe('tidak error');
  });

  it('menyebut sisa stok dan jumlah yang sudah di keranjang', () => {
    expect(messageOf(() => assertQuantityAvailable(5, 3, 'M', 2))).toBe(
      '409 Stok ukuran M tersisa 3, 2 sudah ada di keranjang',
    );
    expect(messageOf(() => assertQuantityAvailable(1, 0, 'L'))).toBe('409 Stok ukuran L habis');
  });

  it('menolak di atas batas per item meski stok cukup', () => {
    expect(messageOf(() => assertQuantityAvailable(100, 500, 'M'))).toBe(
      '409 Maksimal 99 per ukuran dalam satu keranjang',
    );
  });
});

describe('resolveCart saat member login membawa keranjang tamu', () => {
  function seedCart(id: string, userId: string | null, variantIds: string[]) {
    db.carts.push({ id, token: `token-${id}`, userId });
    for (const variantId of variantIds) {
      db.items.push({
        id: `${id}-${variantId}`,
        cartId: id,
        variantId,
        quantity: 1,
        createdAt: new Date(),
      });
    }
  }

  it('memakai keranjang akun dan membuang keranjang tamu', async () => {
    seedCart('guest', null, ['v-m']);
    seedCart('akun', 'u1', ['v-l']);
    const result = await resolveCart({ userId: 'u1', token: 'token-guest' });
    expect(result.cart?.id).toBe('akun');
    expect(result.clearGuestToken).toBe(true);
    expect(db.carts.map((c) => c.id)).toEqual(['akun']);
  });

  it('memindahkan keranjang tamu ke akun bila keranjang akun kosong', async () => {
    seedCart('guest', null, ['v-m']);
    seedCart('akun', 'u1', []);
    const result = await resolveCart({ userId: 'u1', token: 'token-guest' });
    expect(result.cart).toEqual({ id: 'guest', token: 'token-guest', userId: 'u1' });
    expect(db.carts.map((c) => c.id)).toEqual(['guest']);
  });

  it('memindahkan keranjang tamu bila akun belum punya keranjang', async () => {
    seedCart('guest', null, ['v-m']);
    const result = await resolveCart({ userId: 'u1', token: 'token-guest' });
    expect(result.cart?.userId).toBe('u1');
  });

  it('token tamu tidak bisa membuka keranjang milik akun', async () => {
    seedCart('akun', 'u1', ['v-m']);
    const result = await resolveCart({ token: 'token-akun' });
    expect(result.cart).toBeNull();
    expect(result.clearGuestToken).toBe(true);
  });
});

describe('API keranjang', () => {
  const app = createApp();

  function cartCookie(res: request.Response): string | undefined {
    const header = res.headers['set-cookie'] as unknown as string[] | undefined;
    return header?.find((c) => c.startsWith('cart_token='))?.split(';')[0];
  }

  it('GET tanpa cookie mengembalikan keranjang kosong tanpa membuat keranjang', async () => {
    const res = await request(app).get('/api/cart');
    expect(res.status).toBe(200);
    expect(res.body.data.cart).toEqual({ items: [], itemCount: 0, subtotal: 0, hasIssues: false });
    expect(db.carts).toHaveLength(0);
  });

  it('tamu menambah item: keranjang dibuat dan cookie httpOnly dipasang', async () => {
    const res = await request(app).post('/api/cart/items').send({ variantId: 'v-m', quantity: 2 });
    expect(res.status).toBe(201);
    expect(res.body.data.cart.subtotal).toBe(250000);
    expect(res.headers['set-cookie']?.toString()).toContain('HttpOnly');

    const cookie = cartCookie(res)!;
    const again = await request(app).get('/api/cart').set('Cookie', cookie);
    expect(again.body.data.cart.itemCount).toBe(2);
  });

  it('menolak penambahan yang melebihi stok, termasuk yang sudah di keranjang', async () => {
    const first = await request(app)
      .post('/api/cart/items')
      .send({ variantId: 'v-m', quantity: 2 });
    const cookie = cartCookie(first)!;
    const res = await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookie)
      .send({ variantId: 'v-m', quantity: 2 });
    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'INSUFFICIENT_STOCK',
      message: 'Stok ukuran M tersisa 3, 2 sudah ada di keranjang',
    });
  });

  it('menolak ukuran stok 0 dan varian nonaktif', async () => {
    const habis = await request(app).post('/api/cart/items').send({ variantId: 'v-l' });
    expect(habis.status).toBe(409);
    const nonaktif = await request(app).post('/api/cart/items').send({ variantId: 'v-off' });
    expect(nonaktif.status).toBe(404);
    expect(nonaktif.body.error.code).toBe('PRODUCT_UNAVAILABLE');
  });

  it('mengubah jumlah dan menghapus item', async () => {
    const first = await request(app).post('/api/cart/items').send({ variantId: 'v-m' });
    const cookie = cartCookie(first)!;

    const updated = await request(app)
      .patch('/api/cart/items/v-m')
      .set('Cookie', cookie)
      .send({ quantity: 3 });
    expect(updated.body.data.cart.itemCount).toBe(3);

    const tooMany = await request(app)
      .patch('/api/cart/items/v-m')
      .set('Cookie', cookie)
      .send({ quantity: 4 });
    expect(tooMany.status).toBe(409);

    const removed = await request(app).delete('/api/cart/items/v-m').set('Cookie', cookie);
    expect(removed.body.data.cart.items).toEqual([]);
  });

  it('validasi query katalog ditolak sebelum menyentuh database', async () => {
    const res = await request(app).get('/api/products?minPrice=300000&maxPrice=100000');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
