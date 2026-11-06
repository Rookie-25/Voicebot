import { z } from 'zod';
import { Buffer } from 'node:buffer';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const text = (max) => z.string().trim().min(1).max(max);
const item = { id, approved: z.boolean() };
const story = z.strictObject({ ...item, title: text(120), summary: text(400) });
const schema = z.strictObject({
  candidateId: id,
  version: id,
  synthetic: z.boolean(),
  review: z.strictObject({
    approved: z.boolean(),
    reviewedBy: z.string().max(100),
    reviewedAt: z.string().max(40),
  }),
  facts: z
    .array(
      z.strictObject({
        ...item,
        section: z.enum(['background', 'strengths', 'working_style', 'goals']),
        statement: text(600),
      }),
    )
    .max(12),
  projects: z.array(story).max(10),
  stories: z.array(story).max(10),
  evidence: z
    .array(z.strictObject({ ...item, label: text(120), excerpt: text(400) }))
    .min(1)
    .max(20),
  answers: z
    .array(
      z.strictObject({
        ...item,
        title: text(120),
        summary: text(400),
        short: text(400),
        standard: text(900),
        evidenceIds: z.array(id).min(1).max(5),
        followUps: z.array(id).max(5),
      }),
    )
    .min(1)
    .max(20),
});
try {
  const input = process.argv[2];
  if (!input) throw Error('usage');
  const raw = readFileSync(resolve(input), 'utf8');
  if (Buffer.byteLength(raw) > 100000) throw Error('size');
  const data = schema.parse(JSON.parse(raw)),
    publish = process.argv.includes('--publish-reviewed');
  if (
    publish &&
    (!data.review.approved ||
      !data.review.reviewedBy.trim() ||
      !z.iso.datetime().safeParse(data.review.reviewedAt).success)
  )
    throw Error('review');
  for (const group of [data.facts, data.projects, data.stories, data.evidence, data.answers]) {
    if (
      new Set(group.map((v) => v.id)).size !== group.length ||
      (publish && group.some((v) => !v.approved))
    )
      throw Error('approval');
  }
  for (const answer of data.answers) {
    if (
      answer.evidenceIds.some((id) => !data.evidence.some((e) => e.id === id)) ||
      answer.followUps.some((id) => !data.answers.some((a) => a.id === id))
    )
      throw Error('references');
  }
  const q = (value) =>
    typeof value === 'number' ? String(value) : "'" + String(value).replaceAll("'", "''") + "'";
  const statements = [
    '-- OWNER CONTENT: private operator output; never commit or upload without review.',
    'PRAGMA foreign_keys = ON;',
  ];
  const insert = (table, values) =>
    statements.push(`INSERT INTO ${table} VALUES (${values.map(q).join(',')});`);
  statements.push(
    `INSERT INTO candidates(id) VALUES (${q(data.candidateId)}) ON CONFLICT(id) DO NOTHING;`,
  );
  insert('content_versions', [
    data.candidateId,
    data.version,
    publish ? 'published' : 'draft',
    Number(data.synthetic),
  ]);
  const scope = [data.candidateId, data.version],
    approved = publish ? 1 : 0,
    visibility = publish ? 'public' : 'private';
  for (const fact of data.facts)
    insert('candidate_facts', [
      ...scope,
      fact.id,
      fact.section,
      fact.statement,
      approved,
      visibility,
    ]);
  for (const [table, rows] of [
    ['projects', data.projects],
    ['interview_stories', data.stories],
  ])
    for (const row of rows)
      insert(table, [...scope, row.id, row.title, row.summary, approved, visibility]);
  for (const e of data.evidence)
    insert('evidence', [...scope, e.id, e.label, e.excerpt, approved, visibility]);
  for (const a of data.answers) {
    insert('approved_answers', [...scope, a.id, a.title, a.summary, approved, visibility]);
    for (const variant of ['short', 'standard'])
      insert('answer_variants', [...scope, a.id, variant, a[variant], approved]);
  }
  for (const a of data.answers) {
    for (const evidence of a.evidenceIds) insert('answer_evidence', [...scope, a.id, evidence]);
    for (const next of a.followUps) insert('answer_followups', [...scope, a.id, next]);
  }
  const directory = resolve('.local/content');
  mkdirSync(directory, { recursive: true });
  const file = join(directory, `${data.version}-${publish ? 'reviewed' : 'draft'}.sql`);
  if (existsSync(file)) throw Error('existing-output');
  writeFileSync(file, statements.join('\n') + '\n', { flag: 'wx' });
  console.log(
    JSON.stringify({
      status: 'prepared',
      publication: publish ? 'reviewed-public' : 'private-draft',
      answers: data.answers.length,
      output: file,
    }),
  );
} catch {
  console.error(
    'Content was not prepared. Check required fields, unique IDs, evidence/follow-up references, output uniqueness and explicit owner review. No content or credentials were printed.',
  );
  process.exitCode = 1;
}
