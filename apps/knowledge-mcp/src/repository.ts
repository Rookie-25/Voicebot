import {
  AnswerInput,
  AnswerOutput,
  ProfileInput,
  ProfileOutput,
  SearchInput,
  SearchOutput,
  type ServiceClaims,
} from '@voice-bot/mcp-contracts';
import { McpFailure } from '@voice-bot/mcp-contracts/security';
import type { z } from 'zod';
import type { D1Database } from '@cloudflare/workers-types';

export interface KnowledgeContext {
  claims: ServiceClaims;
  traceId: string;
  allowSynthetic: boolean;
}
export class KnowledgeRepository {
  constructor(
    private readonly db: D1Database,
    private readonly context: KnowledgeContext,
  ) {}
  private async published(version: string, signal: AbortSignal) {
    signal.throwIfAborted();
    const { claims } = this.context;
    if (version !== claims.contentVersion) throw new McpFailure('VERSION_MISMATCH');
    const row = await this.db
      .prepare(
        "SELECT synthetic FROM content_versions WHERE candidate_id=? AND id=? AND state='published'",
      )
      .bind(claims.candidateId, version)
      .first<{ synthetic: number }>();
    signal.throwIfAborted();
    if (!row) throw new McpFailure('VERSION_MISMATCH');
    if (row.synthetic === 1 && !this.context.allowSynthetic) throw new McpFailure('FORBIDDEN');
    return {
      candidateId: claims.candidateId,
      contentVersion: version,
      traceId: this.context.traceId,
      synthetic: row.synthetic === 1,
    };
  }
  async profile(input: z.infer<typeof ProfileInput>, signal: AbortSignal) {
    const metadata = await this.published(input.version, signal);
    const slots = input.sections.map(() => '?').join(',');
    const rows = await this.db
      .prepare(
        `SELECT f.id,f.section,f.statement FROM candidate_facts f JOIN content_versions v ON v.candidate_id=f.candidate_id AND v.id=f.version WHERE f.candidate_id=? AND f.version=? AND f.approved=1 AND f.visibility='public' AND v.state='published' AND f.section IN (${slots}) ORDER BY f.id LIMIT 12`,
      )
      .bind(metadata.candidateId, input.version, ...input.sections)
      .all();
    signal.throwIfAborted();
    return ProfileOutput.parse({ status: 'ok', ...metadata, data: { fields: rows.results } });
  }
  async search(input: z.infer<typeof SearchInput>, signal: AbortSignal) {
    const metadata = await this.published(input.version, signal);
    const query =
      '%' +
      input.query
        .normalize('NFKC')
        .replaceAll('\\', '\\\\')
        .replaceAll('%', '\\%')
        .replaceAll('_', '\\_') +
      '%';
    const slots = input.kinds.map(() => '?').join(',');
    const rows = await this.db
      .prepare(
        `SELECT id,kind,title,summary FROM public_knowledge WHERE candidate_id=? AND version=? AND kind IN (${slots}) AND (title LIKE ? ESCAPE '\\' OR summary LIKE ? ESCAPE '\\') ORDER BY kind,id LIMIT ?`,
      )
      .bind(metadata.candidateId, input.version, ...input.kinds, query, query, input.limit)
      .all();
    signal.throwIfAborted();
    return SearchOutput.parse({ status: 'ok', ...metadata, data: { matches: rows.results } });
  }
  async answer(input: z.infer<typeof AnswerInput>, signal: AbortSignal) {
    const metadata = await this.published(input.version, signal);
    const answer = await this.db
      .prepare(
        `SELECT a.id,t.text FROM public_answers a JOIN answer_variants t ON t.candidate_id=a.candidate_id AND t.version=a.version AND t.answer_id=a.id WHERE a.candidate_id=? AND a.version=? AND a.id=? AND t.variant=? AND t.approved=1`,
      )
      .bind(metadata.candidateId, input.version, input.answerId, input.variant)
      .first<{ id: string; text: string }>();
    if (!answer) throw new McpFailure('UNAVAILABLE_CONTENT');
    const evidence = await this.db
      .prepare(
        `SELECT e.id,e.source_label AS label,e.excerpt FROM answer_evidence l JOIN evidence e ON e.candidate_id=l.candidate_id AND e.version=l.version AND e.id=l.evidence_id WHERE l.candidate_id=? AND l.version=? AND l.answer_id=? AND e.approved=1 AND e.visibility='public' ORDER BY e.id LIMIT 6`,
      )
      .bind(metadata.candidateId, input.version, input.answerId)
      .all();
    const followups = await this.db
      .prepare(
        `SELECT a.id FROM answer_followups f JOIN public_answers a ON a.candidate_id=f.candidate_id AND a.version=f.version AND a.id=f.followup_id WHERE f.candidate_id=? AND f.version=? AND f.answer_id=? ORDER BY a.id LIMIT 5`,
      )
      .bind(metadata.candidateId, input.version, input.answerId)
      .all<{ id: string }>();
    signal.throwIfAborted();
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(answer.text));
    const textHash = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('');
    return AnswerOutput.parse({
      status: 'ok',
      ...metadata,
      data: {
        answerId: answer.id,
        variant: input.variant,
        text: answer.text,
        textHash,
        evidence: evidence.results,
        followUpAnswerIds: followups.results.map((row) => row.id),
      },
    });
  }
}
