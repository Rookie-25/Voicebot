import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectKnowledge } from '../apps/gateway/src/mcp-client';
import { handleM2bProbe, type PreviewProbeEnv } from '../apps/gateway/src/m2b-probe';

vi.mock('../apps/gateway/src/mcp-client', () => ({ connectKnowledge: vi.fn() }));
// Synthetic unit-test credentials only; never deploy them.
const operator = 'a'.repeat(64);
const iso = (offset: number) =>
  new Date(Date.now() + offset).toISOString().replace(/\.\d{3}Z$/, 'Z');
let env: PreviewProbeEnv;
function request(
  body: unknown = { case: 'profile' },
  headers: Record<string, string> = {},
  method = 'POST',
) {
  return new Request('https://gateway.test/ops/mcp-probe', {
    method,
    headers: {
      Authorization: `Bearer ${operator}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    ...(method === 'POST' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  env = {
    APP_ENV: 'preview',
    M2B_PROBE_ENABLED: 'true',
    M2B_PROBE_STARTS_AT: iso(-10_000),
    M2B_PROBE_EXPIRES_AT: iso(60_000),
    M2B_OPERATOR_TOKEN: operator,
    MCP_SERVICE_SECRET: 'test-service-key-not-for-cloud-000000',
    CANDIDATE_ID: 'fictional-alex',
    CONTENT_VERSION: 'fixture-v1',
    KNOWLEDGE_MCP: { fetch: vi.fn() },
  };
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('temporary preview probe gates (no MCP construction)', () => {
  it.each([
    { APP_ENV: 'local' },
    { APP_ENV: 'production' },
    { APP_ENV: 'PREVIEW' },
    { M2B_PROBE_ENABLED: 'false' },
    { M2B_PROBE_ENABLED: undefined },
    { M2B_PROBE_EXPIRES_AT: 'UNCONFIGURED' },
    { M2B_PROBE_STARTS_AT: '2026-02-30T00:00:00Z' },
    { M2B_PROBE_EXPIRES_AT: '2020-01-01T00:00:00Z' },
    { M2B_PROBE_STARTS_AT: iso(30_000) },
    { M2B_PROBE_STARTS_AT: iso(-10_000), M2B_PROBE_EXPIRES_AT: iso(3_600_000) },
    { M2B_PROBE_STARTS_AT: '2026-11-06T00:00:00+00:00' },
    { CANDIDATE_ID: 'real-person' },
    { CONTENT_VERSION: 'other-version' },
    { M2B_OPERATOR_TOKEN: 'short' },
  ])('fails closed for invalid configuration %j', async (overrides) => {
    // Explicit undefined exercises absent bindings without weakening production env types.
    const configured = { ...env, ...overrides } as PreviewProbeEnv;
    expect((await handleM2bProbe(request(), configured)).status).toBe(404);
    expect(connectKnowledge).not.toHaveBeenCalled();
  });
  it.each(['', 'Bearer invalid', `Bearer ${'b'.repeat(64)}`, `Bearer ${'a'.repeat(65)}`])(
    'rejects missing/malformed/wrong operator credentials',
    async (Authorization) => {
      const response = await handleM2bProbe(request(undefined, { Authorization }), env);
      expect(response.status).toBe(401);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(response.headers.has('Access-Control-Allow-Origin')).toBe(false);
      expect(connectKnowledge).not.toHaveBeenCalled();
    },
  );
  it.each(['https://browser.test', 'null'])('rejects every browser Origin', async (Origin) => {
    expect((await handleM2bProbe(request(undefined, { Origin }), env)).status).toBe(403);
    expect(connectKnowledge).not.toHaveBeenCalled();
  });
  it.each(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'])('rejects method %s', async (method) => {
    const response = await handleM2bProbe(request(undefined, {}, method), env);
    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('POST');
    expect(connectKnowledge).not.toHaveBeenCalled();
  });
  it.each([
    '{bad-json',
    { case: 'arbitrary-tool' },
    { case: 'profile', candidateId: 'another' },
    { case: 'profile', url: 'https://attacker.test' },
    [],
    {},
  ])('rejects non-allowlisted/extra input %j', async (body) => {
    expect((await handleM2bProbe(request(body), env)).status).toBe(400);
    expect(connectKnowledge).not.toHaveBeenCalled();
  });
  it('requires JSON and enforces the real 2 KiB byte limit', async () => {
    expect(
      (await handleM2bProbe(request('{}', { 'Content-Type': 'text/plain' }), env)).status,
    ).toBe(415);
    for (const body of ['x'.repeat(2049), 'é'.repeat(1025)]) {
      expect((await handleM2bProbe(request(body), env)).status).toBe(413);
    }
    expect((await handleM2bProbe(request('{}', { 'Content-Length': '4096' }), env)).status).toBe(
      413,
    );
    expect(connectKnowledge).not.toHaveBeenCalled();
  });
  it('rejects missing service configuration after auth and before construction', async () => {
    const noBinding = { ...env };
    delete noBinding.KNOWLEDGE_MCP;
    expect((await handleM2bProbe(request(), noBinding)).status).toBe(503);
    expect(connectKnowledge).not.toHaveBeenCalled();
  });
  it('does not disclose an internal exception, key, database content or stack', async () => {
    vi.mocked(connectKnowledge).mockRejectedValueOnce(
      new Error('PRIVATE SQL SELECT synthetic-text secret-value at internal:1'),
    );
    const response = await handleM2bProbe(request(), env);
    expect(response.status).toBe(502);
    expect(await response.text()).not.toMatch(
      /PRIVATE|SELECT|secret-value|internal:1|synthetic-text/,
    );
  });
  it('cancels during SDK initialization without a late success', async () => {
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    vi.mocked(connectKnowledge).mockImplementationOnce(
      (options) =>
        new Promise((_, reject) => {
          options.signal!.addEventListener('abort', () => reject(options.signal!.reason), {
            once: true,
          });
          started();
        }),
    );
    const controller = new AbortController();
    const pending = handleM2bProbe(new Request(request(), { signal: controller.signal }), env);
    await ready;
    controller.abort();
    expect((await pending).status).toBe(408);
  });
  it('bounds a stalled authenticated upload without constructing a client', async () => {
    const init = {
      method: 'POST',
      headers: { Authorization: `Bearer ${operator}`, 'Content-Type': 'application/json' },
      body: new ReadableStream(),
      duplex: 'half',
    };
    const response = await handleM2bProbe(
      new Request('https://gateway.test/ops/mcp-probe', init),
      env,
    );
    expect(response.status).toBe(504);
    expect(connectKnowledge).not.toHaveBeenCalled();
  }, 5000);
  it('expires an in-flight initialization at the absolute UTC deadline', async () => {
    env.M2B_PROBE_EXPIRES_AT = iso(2000);
    vi.mocked(connectKnowledge).mockImplementationOnce(
      (options) =>
        new Promise((_, reject) => {
          options.signal!.addEventListener('abort', () => reject(options.signal!.reason), {
            once: true,
          });
        }),
    );
    const response = await handleM2bProbe(request(), env);
    expect(response.status).toBe(504);
    expect(await response.json()).toMatchObject({ code: 'TIMEOUT' });
  });
});
