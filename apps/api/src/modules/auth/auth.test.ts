import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import { hashPassword } from '../../lib/password.js';
import { errorHandler } from '../../middleware/error-handler.js';
import { loadSession, requireAdmin } from './auth.middleware.js';
import { signSessionToken } from './auth.token.js';

interface FakeUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: 'CUSTOMER' | 'ADMIN' | 'OWNER';
  tokenVersion: number;
  passwordHash: string;
}

// Database tiruan di memori — cukup untuk query yang dipakai modul auth.
const db = vi.hoisted(() => ({ users: [] as FakeUser[] }));

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; email?: string } }) => {
        return (
          db.users.find((u) => (where.id ? u.id === where.id : u.email === where.email)) ?? null
        );
      }),
      findFirst: vi.fn(async ({ where }: { where: { id: string; tokenVersion: number } }) => {
        return (
          db.users.find((u) => u.id === where.id && u.tokenVersion === where.tokenVersion) ?? null
        );
      }),
      create: vi.fn(async ({ data }: { data: Partial<FakeUser> }) => {
        const user: FakeUser = {
          id: `user-${db.users.length + 1}`,
          name: '',
          email: '',
          phone: null,
          role: 'CUSTOMER',
          tokenVersion: 0,
          passwordHash: '',
          ...data,
        };
        db.users.push(user);
        return user;
      }),
    },
  },
}));

const SESSION = 'session';
const budi = { name: 'Budi Santoso', email: 'budi@mail.com', password: 'rahasia123' };

function sessionCookie(res: request.Response): string {
  const header = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = header?.find((c) => c.startsWith(`${SESSION}=`));
  if (!cookie) throw new Error('cookie sesi tidak ada');
  return cookie;
}

async function addUser(role: FakeUser['role'], email: string) {
  const user: FakeUser = {
    id: `seed-${email}`,
    name: role,
    email,
    phone: null,
    role,
    tokenVersion: 0,
    passwordHash: await hashPassword('rahasia123'),
  };
  db.users.push(user);
  return user;
}

let app: ReturnType<typeof createApp>;

beforeEach(() => {
  db.users.length = 0;
  app = createApp(); // limiter baru (memori) per test
});

describe('POST /api/auth/register', () => {
  it('membuat akun CUSTOMER dan memasang cookie sesi httpOnly', async () => {
    const res = await request(app).post('/api/auth/register').send(budi);

    expect(res.status).toBe(201);
    expect(res.body.data.user).toEqual({
      id: 'user-1',
      name: 'Budi Santoso',
      email: 'budi@mail.com',
      phone: null,
      role: 'CUSTOMER',
    });
    const cookie = sessionCookie(res);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(db.users[0]?.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('menolak email yang sudah terdaftar (409)', async () => {
    await request(app).post('/api/auth/register').send(budi);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...budi, email: 'BUDI@mail.com' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('menolak input tidak valid (400)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...budi, password: 'pendek' });
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'password: Password minimal 8 karakter',
    });
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(budi);
  });

  it('berhasil dengan password benar', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: budi.email, password: budi.password });
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(budi.email);
    sessionCookie(res);
  });

  it('pesan sama untuk password salah dan email tidak terdaftar', async () => {
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: budi.email, password: 'salah12345' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'siapa@mail.com', password: 'salah12345' });

    for (const res of [wrongPassword, unknownEmail]) {
      expect(res.status).toBe(401);
      expect(res.body.error).toEqual({
        code: 'INVALID_CREDENTIALS',
        message: 'Email atau password salah',
      });
    }
  });

  it('memblokir setelah 5 login gagal (429), email lain tidak ikut terblokir', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/login').send({ email: budi.email, password: 'salah' });
    }
    const blocked = await request(app)
      .post('/api/auth/login')
      .send({ email: budi.email, password: budi.password });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');

    const other = await request(app)
      .post('/api/auth/login')
      .send({ email: 'lain@mail.com', password: 'salah' });
    expect(other.status).toBe(401);
  });
});

describe('GET /api/auth/me & logout', () => {
  it('401 tanpa cookie', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('mengembalikan user dari cookie sesi, tanpa passwordHash', async () => {
    const reg = await request(app).post('/api/auth/register').send(budi);
    const res = await request(app).get('/api/auth/me').set('Cookie', sessionCookie(reg));
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(budi.email);
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
    expect(res.body.data.user).not.toHaveProperty('tokenVersion');
  });

  it('sesi batal setelah tokenVersion dinaikkan', async () => {
    const reg = await request(app).post('/api/auth/register').send(budi);
    const user = db.users[0];
    if (user) user.tokenVersion += 1;
    const res = await request(app).get('/api/auth/me').set('Cookie', sessionCookie(reg));
    expect(res.status).toBe(401);
  });

  it('token yang diubah ditolak', async () => {
    const reg = await request(app).post('/api/auth/register').send(budi);
    const tampered = sessionCookie(reg).replace(/(session=[^.]+\.)[^.]/, '$1X');
    const res = await request(app).get('/api/auth/me').set('Cookie', tampered);
    expect(res.status).toBe(401);
  });

  it('logout menghapus cookie sesi', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(sessionCookie(res)).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});

describe('POST /api/auth/admin/login', () => {
  const credentials = (email: string) => ({ email, password: 'rahasia123' });

  it.each(['ADMIN', 'OWNER'] as const)('%s berhasil dan mendapat sesi', async (role) => {
    await addUser(role, `${role.toLowerCase()}@toko.id`);
    const res = await request(app)
      .post('/api/auth/admin/login')
      .send(credentials(`${role.toLowerCase()}@toko.id`));
    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe(role);
    sessionCookie(res);
  });

  it('CUSTOMER ditolak (403) tanpa cookie sesi', async () => {
    await addUser('CUSTOMER', 'pembeli@mail.com');
    const res = await request(app)
      .post('/api/auth/admin/login')
      .send(credentials('pembeli@mail.com'));
    expect(res.status).toBe(403);
    expect(res.body.error).toEqual({
      code: 'NOT_ADMIN',
      message: 'Akun ini tidak memiliki akses admin',
    });
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('password salah tetap pesan umum (401)', async () => {
    await addUser('ADMIN', 'admin@toko.id');
    const res = await request(app)
      .post('/api/auth/admin/login')
      .send({ email: 'admin@toko.id', password: 'salah12345' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('berbagi batas percobaan dengan login customer', async () => {
    await addUser('ADMIN', 'admin@toko.id');
    const wrong = { email: 'admin@toko.id', password: 'salah' };
    for (let i = 0; i < 3; i++) await request(app).post('/api/auth/login').send(wrong);
    for (let i = 0; i < 2; i++) await request(app).post('/api/auth/admin/login').send(wrong);
    const res = await request(app).post('/api/auth/admin/login').send(credentials('admin@toko.id'));
    expect(res.status).toBe(429);
  });
});

describe('requireAdmin', () => {
  const adminApp = express()
    .use(cookieParser())
    .use(loadSession)
    .get('/admin-only', requireAdmin, (_req, res) => {
      res.json({ data: 'ok' });
    })
    .use(errorHandler);

  async function cookieFor(user: FakeUser) {
    const token = await signSessionToken({ userId: user.id, tokenVersion: user.tokenVersion });
    return `${SESSION}=${token}`;
  }

  it('401 tanpa sesi', async () => {
    expect((await request(adminApp).get('/admin-only')).status).toBe(401);
  });

  it('403 untuk CUSTOMER', async () => {
    const customer = await addUser('CUSTOMER', 'c@mail.com');
    const res = await request(adminApp)
      .get('/admin-only')
      .set('Cookie', await cookieFor(customer));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it.each(['ADMIN', 'OWNER'] as const)('200 untuk %s', async (role) => {
    const user = await addUser(role, `${role}@mail.com`);
    const res = await request(adminApp)
      .get('/admin-only')
      .set('Cookie', await cookieFor(user));
    expect(res.status).toBe(200);
  });
});
