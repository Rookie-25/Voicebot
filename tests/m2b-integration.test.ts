import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { MCP_REVISION } from '@voice-bot/mcp-contracts';

// Synthetic test keys, not deployment credentials.
const operator = 'b'.repeat(64);
const secret = 'synthetic-m2b-runtime-key-never-deploy-0001';
let runtime: Miniflare;
const common = {
  modules: true as const,
  compatibilityDate: '2026-11-06',
  compatibilityFlags: ['nodejs_compat'],
};
beforeAll(async () => {
  const start = new Date(Date.now() - 10_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const end = new Date(Date.now() + 600_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  runtime = new Miniflare(
    convertV4MiniflareOptions({
      host: '127.0.0.1',
      port: 0,
      workers: [
        {
          ...common,
          name: 'gateway',
          scriptPath: resolve('apps/gateway/dist/index.js'),
          bindings: {
            APP_ENV: 'preview',
            CANDIDATE_ID: 'fictional-alex',
            CONTENT_VERSION: 'fixture-v1',
            MCP_SERVICE_SECRET: secret,
            M2B_OPERATOR_TOKEN: operator,
            M2B_PROBE_ENABLED: 'true',
            M2B_PROBE_STARTS_AT: start,
            M2B_PROBE_EXPIRES_AT: end,
            LOCAL_MCP_DIAGNOSTICS: 'false',
          },
          serviceBindings: { KNOWLEDGE_MCP: 'knowledge' },
        },
        {
          ...common,
          name: 'knowledge',
          scriptPath: resolve('apps/knowledge-mcp/dist/index.js'),
          bindings: {
            APP_ENV: 'preview',
            CANDIDATE_ID: 'fictional-alex',
            CONTENT_VERSION: 'fixture-v1',
            MCP_SERVICE_SECRET: secret,
            ALLOW_SYNTHETIC_DATA: 'true',
          },
          d1Databases: { DB: 'm2b-preview-fixture-local-test' },
        },
      ],
    }),
  );
  await runtime.ready;
  const db = await runtime.getD1Database('DB', 'knowledge');
  for (const file of [
    'apps/knowledge-mcp/migrations/0001_approved_knowledge.sql',
    'tests/fixtures/preview-approved.sql',
  ]) {
    const sql = readFileSync(file, 'utf8').replace(/^--.*$/gm, '');
    for (const statement of sql.split(';').filter((part) => part.trim()))
      await db.prepare(statement).run();
  }
}, 30_000);
afterAll(async () => {
  await runtime?.dispose();
});

async function probe(testCase: string, token = operator) {
  return runtime.dispatchFetch('https://gateway.test/ops/mcp-probe', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ case: testCase }),
  });
}
describe('M2B preview probe across genuine local workerd service binding', () => {
  it.each(['profile', 'search', 'answer', 'answer-standard', 'followup'])(
    'negotiates/discovers/invokes %s and returns only sanitized proof',
    async (testCase) => {
      const response = await probe(testCase);
      const text = await response.text();
      expect(response.status, text).toBe(200);
      const result = JSON.parse(text);
      expect(result).toMatchObject({
        status: 'passed',
        outcome: 'OK',
        revision: MCP_REVISION,
        checks: { protocol: true, trace: true, content: true, expectedOutcome: true },
      });
      expect(result.methods).toEqual([
        'initialize',
        'notifications/initialized',
        'tools/list',
        'tools/call',
      ]);
      expect(result.tools.sort()).toEqual([
        'get_candidate_profile',
        'retrieve_approved_answer',
        'search_interview_knowledge',
      ]);
      expect(result.traceId).toBe(response.headers.get('X-Trace-ID'));
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(response.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
      expect(response.headers.has('Access-Control-Allow-Origin')).toBe(false);
      expect(text).not.toMatch(
        /SYNTHETIC FIXTURE|fictional-alex|sample-evidence|Bearer|eyJ|SELECT|stack|textHash/,
      );
      expect(text).not.toContain(secret);
      expect(text).not.toContain(operator);
    },
  );
  it.each([
    ['missing-service-auth', 'UNAUTHORIZED'],
    ['invalid-service-auth', 'UNAUTHORIZED'],
    ['wrong-candidate', 'FORBIDDEN'],
    ['wrong-environment', 'FORBIDDEN'],
    ['wrong-version', 'VERSION_MISMATCH'],
    ['wrong-tool-version', 'VERSION_MISMATCH'],
    ['insufficient-scope', 'FORBIDDEN'],
    ['missing-answer', 'UNAVAILABLE_CONTENT'],
    ['invalid-tool-input', 'INVALID_INPUT'],
  ])('reports only the expected security denial for %s', async (testCase, outcome) => {
    const response = await probe(testCase);
    const result = await response.json();
    expect(response.status, JSON.stringify(result)).toBe(200);
    expect(result).toMatchObject({
      status: 'passed',
      outcome,
      checks: { trace: true, expectedOutcome: true },
    });
    expect(JSON.stringify(result)).not.toMatch(/Bearer|SYNTHETIC FIXTURE|SELECT|stack/);
  });
  it('rejects wrong operator token, Origin, invalid input and alternate routes', async () => {
    expect((await probe('profile', 'c'.repeat(64))).status).toBe(401);
    const origin = await runtime.dispatchFetch('https://gateway.test/ops/mcp-probe', {
      method: 'POST',
      headers: { Origin: 'https://browser.test' },
    });
    expect(origin.status).toBe(403);
    expect((await probe('arbitrary')).status).toBe(400);
    expect((await runtime.dispatchFetch('https://gateway.test/ops/mcp-probe')).status).toBe(405);
    expect(
      (await runtime.dispatchFetch('https://gateway.test/mcp', { method: 'POST' })).status,
    ).toBe(404);
    expect(
      (await runtime.dispatchFetch('https://gateway.test/api/v1/turn', { method: 'POST' })).status,
    ).toBe(501);
  });
  it('isolates trace IDs for repeated sequential requests', async () => {
    const first = (await (await probe('profile')).json()) as { traceId: string };
    const second = (await (await probe('profile')).json()) as { traceId: string };
    expect(first.traceId).not.toBe(second.traceId);
  });
  it('validates the approved-only fixture and enforces foreign keys in local D1', async () => {
    const db = await runtime.getD1Database('DB', 'knowledge');
    expect((await db.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
    expect((await db.prepare('SELECT * FROM content_versions').all()).results).toEqual([
      { candidate_id: 'fictional-alex', id: 'fixture-v1', state: 'published', synthetic: 1 },
    ]);
    for (const table of [
      'candidate_facts',
      'projects',
      'interview_stories',
      'evidence',
      'approved_answers',
    ]) {
      expect(
        (
          await db
            .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE approved<>1 OR visibility<>'public'`)
            .first()
        )?.n,
      ).toBe(0);
    }
    expect(
      (await db.prepare('SELECT COUNT(*) AS n FROM answer_variants WHERE approved=1').first())?.n,
    ).toBe(4);
    expect((await db.prepare('SELECT COUNT(*) AS n FROM public_answers').first())?.n).toBe(2);
    await expect(
      db
        .prepare(
          "INSERT INTO answer_evidence VALUES ('fictional-alex','fixture-v1','intro','missing-evidence')",
        )
        .run(),
    ).rejects.toThrow();
  });
});

it('keeps the probe disabled by default, routes preview assets correctly and preserves production config', () => {
  const readConfig = (file: string) =>
    ts.parseConfigFileTextToJson(file, readFileSync(file, 'utf8')).config;
  const gateway = readConfig('apps/gateway/wrangler.jsonc');
  expect(gateway.env.preview.assets.run_worker_first).toContain('/ops/mcp-probe');
  expect(gateway.env.preview.vars.M2B_PROBE_ENABLED).toBe('false');
  expect(gateway.env.preview.vars.M2B_PROBE_STARTS_AT).toBe('UNCONFIGURED');
  expect(gateway.env.preview.vars.M2B_PROBE_EXPIRES_AT).toBe('UNCONFIGURED');
  expect(gateway.env.preview.workers_dev).toBe(true);
  expect(gateway.env.production.vars).toEqual({
    APP_ENV: 'production',
    LOCAL_MCP_DIAGNOSTICS: 'false',
    CANDIDATE_ID: 'UNCONFIGURED',
    CONTENT_VERSION: 'UNCONFIGURED',
  });
  const knowledge = readConfig('apps/knowledge-mcp/wrangler.jsonc');
  for (const env of [knowledge, knowledge.env.preview, knowledge.env.production]) {
    expect(env.workers_dev).toBe(false);
    expect(env.preview_urls).toBe(false);
    expect(env.routes).toEqual([]);
  }
  expect(knowledge.env.production.vars.ALLOW_SYNTHETIC_DATA).toBe('false');
  expect(gateway.env.preview.services[0].service).toBe(knowledge.env.preview.name);
});
