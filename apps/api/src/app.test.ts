import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkHealth } from './modules/health/health.service.js';
import { createApp } from './app.js';

vi.mock('./modules/health/health.service.js', () => ({
  checkHealth: vi.fn(),
}));

const app = createApp();

describe('format response error', () => {
  it('endpoint tidak dikenal → 404 { error }', async () => {
    const res = await request(app).get('/api/tidak-ada');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan' },
    });
  });

  it('body JSON rusak → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/tidak-ada')
      .set('Content-Type', 'application/json')
      .send('{"rusak":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.mocked(checkHealth).mockReset();
  });

  it('200 saat DB dan Redis up', async () => {
    vi.mocked(checkHealth).mockResolvedValue({ status: 'ok', database: 'up', redis: 'up' });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { status: 'ok', database: 'up', redis: 'up' } });
  });

  it('503 saat salah satu service down', async () => {
    vi.mocked(checkHealth).mockResolvedValue({
      status: 'degraded',
      database: 'down',
      redis: 'up',
    });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body.data.database).toBe('down');
  });

  it('500 dengan format { error } saat terjadi exception', async () => {
    vi.mocked(checkHealth).mockRejectedValue(new Error('boom'));
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});
