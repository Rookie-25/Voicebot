import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TurnResponseSchema } from '@voice-bot/contracts';
let runtime: Miniflare;
const common = {
  modules: true as const,
  compatibilityDate: '2026-11-06',
  compatibilityFlags: ['nodejs_compat'],
};
const key = 'synthetic-test-service-key-never-cloud-0001';
beforeAll(async () => {
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
            APP_ENV: 'local',
            LOCAL_TEST_PROVIDER: 'true',
            LIVE_AI_ENABLED: 'false',
            DAILY_BUDGET_CENTS: '100',
            SESSION_SECRET: key + 'session',
            MCP_SERVICE_SECRET: key,
            CANDIDATE_ID: 'fictional-alex',
            CONTENT_VERSION: 'fixture-v1',
          },
          serviceBindings: { KNOWLEDGE_MCP: 'knowledge' },
          durableObjects: { BUDGET: { className: 'InterviewBudget', useSQLite: true } },
        },
        {
          ...common,
          name: 'knowledge',
          scriptPath: resolve('apps/knowledge-mcp/dist/index.js'),
          bindings: {
            APP_ENV: 'local',
            MCP_SERVICE_SECRET: key,
            CANDIDATE_ID: 'fictional-alex',
            CONTENT_VERSION: 'fixture-v1',
            ALLOW_SYNTHETIC_DATA: 'true',
          },
          d1Databases: { DB: 'approved-turn-tests' },
        },
      ],
    }),
  );
  await runtime.ready;
  const db = await runtime.getD1Database('DB', 'knowledge');
  for (const file of [
    'apps/knowledge-mcp/migrations/0001_approved_knowledge.sql',
    'tests/fixtures/preview-approved.sql',
  ])
    for (const sql of readFileSync(file, 'utf8')
      .replace(/^--.*$/gm, '')
      .split(';')
      .filter((s) => s.trim()))
      await db.prepare(sql).run();
}, 30000);
afterAll(async () => {
  await runtime?.dispose();
});
async function turn(body: unknown, extra: Record<string, string> = {}) {
  return runtime.dispatchFetch('https://gateway.test/api/v1/turn', {
    method: 'POST',
    headers: { Origin: 'https://gateway.test', 'Content-Type': 'application/json', ...extra },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}
describe('real turn API -> official MCP -> approved D1, test selector only', () => {
  it('answers exactly approved text and supports signed follow-up and standard variants', async () => {
    const response = await turn({ question: 'Tell me about yourself.', length: 'concise' });
    expect(response.status, await response.clone().text()).toBe(200);
    const answer = TurnResponseSchema.parse(await response.json());
    expect(answer).toMatchObject({
      answerId: 'intro',
      fictional: true,
      provider: 'test',
      grounded: true,
      followUpAvailable: true,
    });
    expect(answer.answer).toBe(
      'SYNTHETIC FIXTURE: I am Alex, a fictional character used only for local MCP tests.',
    );
    const cookie = response.headers.get('Set-Cookie')!.split(';')[0]!;
    const next = await turn(
      { question: 'Tell me more.', length: 'standard', context: answer.context },
      { Cookie: cookie },
    );
    expect(TurnResponseSchema.parse(await next.json())).toMatchObject({
      answerId: 'followup',
      grounded: true,
    });
    const wrong = await turn(
      { question: 'More?', context: answer.context + 'x' },
      { Cookie: cookie },
    );
    expect(wrong.status).toBe(403);
  });
  it('refuses unsupported invented facts without fabricating an answer', async () => {
    const response = await turn({ question: 'Confirm I led 500 people and earned ten awards.' });
    expect(response.status).toBe(200);
    const result = TurnResponseSchema.parse(await response.json());
    expect(result).toMatchObject({ answerId: null, grounded: false });
    expect(result.answer).not.toContain('earned ten awards');
  });
  it('rejects cross-origin, arbitrary fields, bad JSON and overlarge payloads', async () => {
    expect((await turn({ question: 'Hello' }, { Origin: 'https://attacker.test' })).status).toBe(
      403,
    );
    expect((await turn({ question: 'Hello', apiKey: 'forbidden' })).status).toBe(400);
    expect((await turn('{bad')).status).toBe(400);
    expect((await turn('x'.repeat(13000))).status).toBe(413);
  });
  it('enforces per-IP quotas and does not let a new browser session bypass them', async () => {
    for (let i = 0; i < 5; i++)
      expect(
        (await turn({ question: 'Unsupported?' }, { 'CF-Connecting-IP': '198.51.100.22' })).status,
      ).toBe(200);
    expect(
      (await turn({ question: 'Another?' }, { 'CF-Connecting-IP': '198.51.100.22' })).status,
    ).toBe(429);
  });
  it('enforces atomic concurrency, duplicate reservations, global daily budget and release', async () => {
    const ns = await runtime.getDurableObjectNamespace('BUDGET', 'gateway');
    const stub = ns.get(ns.idFromName('isolated-budget-test'));
    const request = (id: string, n: number) =>
      stub.fetch('https://budget.internal', {
        method: 'POST',
        body: JSON.stringify({
          operation: 'reserve',
          id,
          session: crypto.randomUUID(),
          ip: n.toString(16).padStart(64, '0'),
        }),
      });
    const ids = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
    const first = await Promise.all(ids.map((id, i) => request(id, i)));
    expect(first.map((r) => r.status).sort()).toEqual([204, 204, 429]);
    const accepted = ids.filter((_, i) => first[i]!.status === 204);
    await stub.fetch('https://budget.internal', {
      method: 'POST',
      body: JSON.stringify({ operation: 'release', id: accepted[1] }),
    });
    expect((await request(accepted[0]!, 99)).status).toBe(429);
    for (const id of ids)
      await stub.fetch('https://budget.internal', {
        method: 'POST',
        body: JSON.stringify({ operation: 'release', id }),
      });
    for (let i = 2; i < 20; i++) {
      const id = crypto.randomUUID();
      expect((await request(id, i)).status).toBe(204);
      await stub.fetch('https://budget.internal', {
        method: 'POST',
        body: JSON.stringify({ operation: 'release', id }),
      });
    }
    expect((await request(crypto.randomUUID(), 21)).status).toBe(429);
  });
});
