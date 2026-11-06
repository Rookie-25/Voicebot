import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

it('requires explicit owner review before publication and emits only private drafts by default', () => {
  const version = 'import-test-' + crypto.randomUUID();
  const input = {
    candidateId: 'fictional-import-test',
    version,
    synthetic: true,
    review: { approved: false, reviewedBy: '', reviewedAt: '' },
    facts: [],
    projects: [],
    stories: [],
    evidence: [
      {
        id: 'evidence',
        label: 'Synthetic test source',
        excerpt: 'Explicitly fictional test material.',
        approved: false,
      },
    ],
    answers: [
      {
        id: 'intro',
        title: 'Fictional introduction',
        summary: 'Synthetic test only.',
        short: "I'm a fictional test character.",
        standard: "I'm a fictional test character.",
        evidenceIds: ['evidence'],
        followUps: [],
        approved: false,
      },
    ],
  };
  mkdirSync('.local/artifacts', { recursive: true });
  const path = resolve('.local/artifacts/' + version + '.json');
  writeFileSync(path, JSON.stringify(input));
  const run = (publish = false) =>
    spawnSync(
      process.execPath,
      ['scripts/prepare-candidate.mjs', path, ...(publish ? ['--publish-reviewed'] : [])],
      { encoding: 'utf8' },
    );
  expect(run().status).toBe(0);
  const draft = readFileSync('.local/content/' + version + '-draft.sql', 'utf8');
  expect(draft).toContain("'draft'");
  expect(draft).toContain("0,'private'");
  const rejected = run(true);
  expect(rejected.status).toBe(1);
  expect(rejected.stderr).not.toContain('fictional test character');
  input.review = {
    approved: true,
    reviewedBy: 'Synthetic test operator',
    reviewedAt: new Date().toISOString(),
  };
  input.answers[0]!.approved = true;
  input.evidence[0]!.approved = true;
  writeFileSync(path, JSON.stringify(input));
  expect(run(true).status).toBe(0);
  const published = readFileSync('.local/content/' + version + '-reviewed.sql', 'utf8');
  expect(published).toContain("'published'");
  expect(published).toContain("1,'public'");
});
