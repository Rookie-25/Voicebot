import { afterAll, beforeAll, expect, it } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

let runtime: Miniflare;
beforeAll(async () => {
  runtime = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      scriptPath: resolve('apps/knowledge-mcp/dist/index.js'),
      compatibilityDate: '2026-11-06',
      compatibilityFlags: ['nodejs_compat'],
      host: '127.0.0.1',
      port: 0,
      d1Databases: { DB: 'approved-preview-fixture-test' },
    }),
  );
  await runtime.ready;
  const db = await runtime.getD1Database('DB');
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

it('keeps the preview fixture published, approved, fictional and referentially valid', async () => {
  const db = await runtime.getD1Database('DB');
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

it('keeps knowledge private, preview bound correctly and temporary probe configuration absent', () => {
  const readConfig = (file: string) =>
    ts.parseConfigFileTextToJson(file, readFileSync(file, 'utf8')).config;
  const gateway = readConfig('apps/gateway/wrangler.jsonc');
  const knowledge = readConfig('apps/knowledge-mcp/wrangler.jsonc');
  expect(Object.keys(gateway.env.preview.vars).some((key) => key.startsWith('M2B_'))).toBe(false);
  expect(gateway.env.preview.assets.run_worker_first).not.toContain('/ops/mcp-probe');
  expect(gateway.env.preview.workers_dev).toBe(true);
  expect(gateway.env.preview.services[0].service).toBe(knowledge.env.preview.name);
  expect(knowledge.env.preview.d1_databases[0].binding).toBe('DB');
  expect(knowledge.env.preview.d1_databases[0].database_name).toBe('voice-bot-knowledge-preview');
  for (const env of [knowledge, knowledge.env.preview, knowledge.env.production]) {
    expect(env.workers_dev).toBe(false);
    expect(env.preview_urls).toBe(false);
    expect(env.routes).toEqual([]);
  }
});
