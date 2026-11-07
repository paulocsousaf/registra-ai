import { describe, it, expect } from 'vitest';
import { buildApp } from './app.js';

describe('Fastify Base Application', () => {
  it('GET /health deve retornar status 200 com ok', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });

  it('POST /webhook deve retornar 200 para payload estrutural', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/webhook',
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.received).toBe(true);
  });
});
