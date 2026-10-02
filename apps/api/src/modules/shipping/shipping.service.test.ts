import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../lib/http-error.js';
import { titleCase } from './region.service.js';
import { getShippingRates, quoteShipping, shippingCacheKey } from './shipping.service.js';

const store = vi.hoisted(() => ({
  settings: new Map<string, unknown>(),
  cache: new Map<string, string>(),
}));

vi.mock('../../config/env.js', async (original) => {
  const actual = await original<{ env: Record<string, unknown> }>();
  return { env: { ...actual.env, RAJAONGKIR_API_KEY: 'kunci-test' } };
});

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    setting: {
      findMany: vi.fn(async () =>
        [...store.settings.entries()].map(([key, value]) => ({ key, value })),
      ),
    },
  },
}));

vi.mock('../../lib/redis.js', () => ({
  redis: {
    get: vi.fn(async (key: string) => store.cache.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store.cache.set(key, value);
      return 'OK';
    }),
  },
}));

const rajaOngkirResponse = {
  meta: { message: 'Success Calculate Domestic Shipping cost', code: 200, status: 'success' },
  data: [
    {
      name: 'Jalur Nugraha Ekakurir (JNE)',
      code: 'jne',
      service: 'YES',
      description: 'Yakin Esok Sampai',
      cost: 36000,
      etd: '1 day',
    },
    {
      name: 'Jalur Nugraha Ekakurir (JNE)',
      code: 'jne',
      service: 'REG',
      description: 'Layanan Reguler',
      cost: 18000,
      etd: '2-3 day',
    },
    {
      name: 'SiCepat Express',
      code: 'sicepat',
      service: 'REG',
      description: 'Reguler',
      cost: 16000,
      etd: '2-3 day',
    },
    {
      name: 'TIKI',
      code: 'tiki',
      service: 'ECO',
      description: 'Ekonomi',
      cost: 12000,
      etd: '4 day',
    },
    {
      name: 'Jalur Nugraha Ekakurir (JNE)',
      code: 'jne',
      service: 'JTR',
      description: 'JNE Trucking',
      cost: 9000,
      etd: '5-7 day',
    },
    {
      name: 'SiCepat Express',
      code: 'sicepat',
      service: 'GOKIL',
      description: 'Cargo Per Kg (Minimal 10 kg)',
      cost: 8000,
      etd: '3-5 day',
    },
  ],
};

const fetchMock = vi.fn();

beforeEach(() => {
  store.settings = new Map<string, unknown>([
    ['shipping.originDistrictId', 1391],
    ['shipping.couriers', ['jne', 'sicepat']],
  ]);
  store.cache.clear();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(JSON.stringify(rajaOngkirResponse), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getShippingRates', () => {
  it('meminta ongkir antar kecamatan dengan kurir aktif dan berat dalam gram', async () => {
    await getShippingRates(5021, 600);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://rajaongkir.komerce.id/api/v1/calculate/district/domestic-cost');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).key).toBe('kunci-test');
    expect(Object.fromEntries(new URLSearchParams(String(init.body)))).toEqual({
      origin: '1391',
      destination: '5021',
      weight: '600',
      courier: 'jne:sicepat',
    });
  });

  it('hanya kurir aktif, tanpa layanan kargo/truk, urut termurah', async () => {
    const rates = await getShippingRates(5021, 600);
    expect(rates.map((r) => `${r.courier}:${r.service}:${r.cost}`)).toEqual([
      'sicepat:REG:16000',
      'jne:REG:18000',
      'jne:YES:36000',
    ]);
  });

  it('memakai cache 24 jam: panggilan kedua tidak memakai kuota RajaOngkir', async () => {
    await getShippingRates(5021, 600);
    await getShippingRates(5021, 600);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(store.cache.has('ongkir:1391:5021:600:jne,sicepat')).toBe(true);
  });

  it('kuota habis menjadi pesan yang bisa dipahami pembeli', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ meta: { message: 'Too Many Requests', code: 429 }, data: null }),
        {
          status: 429,
        },
      ),
    );
    await expect(getShippingRates(5021, 600)).rejects.toMatchObject({
      status: 503,
      code: 'SHIPPING_UNAVAILABLE',
    });
  });

  it('timeout dianggap gangguan sementara, bukan alamat salah', async () => {
    fetchMock.mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError'));
    await expect(getShippingRates(5021, 600)).rejects.toMatchObject({
      status: 503,
      message: 'Ongkir sedang tidak bisa dihitung. Coba lagi beberapa saat lagi.',
    });
  });

  it('pengaturan toko belum lengkap ditolak sebelum memanggil RajaOngkir', async () => {
    store.settings.delete('shipping.couriers');
    await expect(getShippingRates(5021, 600)).rejects.toBeInstanceOf(HttpError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('quoteShipping', () => {
  it('mengambil ongkir layanan yang dipilih dari hasil server, bukan dari client', async () => {
    const quote = await quoteShipping({
      destinationDistrictId: 5021,
      weightGram: 600,
      courier: 'JNE',
      service: 'reg',
    });
    expect(quote).toMatchObject({ courier: 'jne', service: 'REG', cost: 18000 });
  });

  it('layanan yang tidak tersedia ditolak', async () => {
    await expect(
      quoteShipping({
        destinationDistrictId: 5021,
        weightGram: 600,
        courier: 'tiki',
        service: 'ECO',
      }),
    ).rejects.toMatchObject({ code: 'SHIPPING_UNAVAILABLE' });
  });
});

describe('helper', () => {
  it('key cache tidak bergantung urutan kurir', () => {
    expect(shippingCacheKey(1, 2, 300, ['sicepat', 'jne'])).toBe('ongkir:1:2:300:jne,sicepat');
  });

  it('nama wilayah dari RajaOngkir dibuat huruf awal kapital', () => {
    expect(titleCase('JAKARTA SELATAN')).toBe('Jakarta Selatan');
    expect(titleCase('NUSA TENGGARA BARAT (NTB)')).toBe('Nusa Tenggara Barat (NTB)');
    expect(titleCase('DKI JAKARTA')).toBe('DKI Jakarta');
  });
});
