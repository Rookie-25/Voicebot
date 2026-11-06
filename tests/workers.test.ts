import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { ApiErrorSchema, HealthResponseSchema } from '@voice-bot/contracts';

describe('actual local Workers runtime', () => {
  let gateway: Miniflare;
  let knowledge: Miniflare;
  beforeAll(async () => {
    gateway = new Miniflare(
      convertV4MiniflareOptions({
        modules: true,
        scriptPath: resolve('apps/gateway/dist/index.js'),
        compatibilityDate: '2026-11-06',
        compatibilityFlags: ['nodejs_compat'],
        bindings: { APP_ENV: 'preview', LOCAL_TEST_PROVIDER: 'true', LIVE_AI_ENABLED: 'false' },
        host: '127.0.0.1',
        port: 0,
      }),
    );
    knowledge = new Miniflare(
      convertV4MiniflareOptions({
        modules: true,
        scriptPath: resolve('apps/knowledge-mcp/dist/index.js'),
        compatibilityDate: '2026-11-06',
        compatibilityFlags: ['nodejs_compat'],
        host: '127.0.0.1',
        port: 0,
      }),
    );
    await Promise.all([gateway.ready, knowledge.ready]);
  }, 30000);
  afterAll(async () => {
    await Promise.all([gateway?.dispose(), knowledge?.dispose()]);
  });
  it('serves gateway health with security headers', async () => {
    const response = await gateway.dispatchFetch('http://localhost/healthz');
    expect(response.status).toBe(200);
    expect(HealthResponseSchema.parse(await response.json()).service).toBe('gateway');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(response.headers.get('permissions-policy')).toContain('microphone=(self)');
  });
  it('supports HEAD and rejects health mutations', async () => {
    expect(
      await (await gateway.dispatchFetch('http://localhost/healthz', { method: 'HEAD' })).text(),
    ).toBe('');
    expect(
      (await gateway.dispatchFetch('http://localhost/healthz', { method: 'POST' })).status,
    ).toBe(405);
  });
  it('reserves v1 API routes without pretending AI is operational', async () => {
    const response = await gateway.dispatchFetch('http://localhost/api/v1/turn', {
      method: 'POST',
    });
    expect(response.status).toBe(503);
    expect(ApiErrorSchema.parse(await response.json()).error.code).toBe('UNAVAILABLE');
    expect((await gateway.dispatchFetch('http://localhost/api/v2/turn')).status).toBe(404);
  });
  it('ignores the deterministic provider flag outside local mode', async () => {
    const response = await gateway.dispatchFetch('http://localhost/api/v1/config');
    expect(await response.json()).toMatchObject({ available: false, provider: 'disabled' });
  });
  it('does not expose the retired operator probe', async () => {
    const response = await gateway.dispatchFetch('http://localhost/ops/mcp-probe', {
      method: 'POST',
      body: JSON.stringify({ case: 'profile' }),
    });
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain('traceId');
  });
  it('keeps knowledge health and rejects an untrusted MCP Host', async () => {
    const response = await knowledge.dispatchFetch('http://localhost/healthz');
    expect(HealthResponseSchema.parse(await response.json()).service).toBe('knowledge-mcp');
    expect((await knowledge.dispatchFetch('http://localhost/mcp', { method: 'POST' })).status).toBe(
      403,
    );
  });
});

it('keeps knowledge private and isolates service binding targets in every environment', () => {
  const readConfig = (path: string) => {
    const parsed = ts.parseConfigFileTextToJson(path, readFileSync(path, 'utf8'));
    if (parsed.error) throw new Error('Invalid Worker JSONC configuration.');
    return parsed.config;
  };
  const config = readConfig('apps/knowledge-mcp/wrangler.jsonc');
  for (const env of [config, config.env.preview, config.env.production]) {
    expect(env.workers_dev).toBe(false);
    expect(env.preview_urls).toBe(false);
    expect(env.routes).toEqual([]);
  }
  const gateway = readConfig('apps/gateway/wrangler.jsonc');
  expect(gateway.env.preview.services[0].service).toBe(config.env.preview.name);
  expect(gateway.env.production.services[0].service).toBe(config.env.production.name);
});
