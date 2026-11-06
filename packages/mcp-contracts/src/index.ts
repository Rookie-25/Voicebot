import { z } from 'zod';

export const MCP_REVISION = '2025-11-25' as const;
export const Identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
export const TraceId = z.uuid();
export const Environment = z.enum(['local', 'preview', 'production']);
export const Scope = z.enum(['profile:read', 'knowledge:search', 'answers:read']);
export const READ_SCOPES = ['profile:read', 'knowledge:search', 'answers:read'] as const;
export const Section = z.enum(['background', 'strengths', 'working_style', 'goals']);
export const Kind = z.enum(['answer', 'project', 'story', 'evidence']);
export const ProfileInput = z.strictObject({
  version: Identifier,
  sections: z.array(Section).min(1).max(4),
});
export const SearchInput = z.strictObject({
  version: Identifier,
  // Empty text intentionally browses at most five approved public items.
  query: z.string().trim().max(500),
  kinds: z.array(Kind).min(1).max(4),
  limit: z.number().int().min(1).max(5),
});
export const AnswerInput = z.strictObject({
  version: Identifier,
  answerId: Identifier,
  variant: z.enum(['short', 'standard']),
});
export const ToolName = z.enum([
  'get_candidate_profile',
  'search_interview_knowledge',
  'retrieve_approved_answer',
]);
export type ToolName = z.infer<typeof ToolName>;
export const toolInputs = {
  get_candidate_profile: ProfileInput,
  search_interview_knowledge: SearchInput,
  retrieve_approved_answer: AnswerInput,
};

const Metadata = {
  candidateId: Identifier,
  contentVersion: Identifier,
  traceId: TraceId,
  synthetic: z.boolean(),
};
export const ProfileOutput = z.strictObject({
  status: z.literal('ok'),
  ...Metadata,
  data: z.strictObject({
    fields: z
      .array(
        z.strictObject({ id: Identifier, section: Section, statement: z.string().min(1).max(600) }),
      )
      .max(12),
  }),
});
export const SearchOutput = z.strictObject({
  status: z.literal('ok'),
  ...Metadata,
  data: z.strictObject({
    matches: z
      .array(
        z.strictObject({
          id: Identifier,
          kind: Kind,
          title: z.string().min(1).max(120),
          summary: z.string().max(400),
        }),
      )
      .max(5),
  }),
});
export const AnswerOutput = z.strictObject({
  status: z.literal('ok'),
  ...Metadata,
  data: z.strictObject({
    answerId: Identifier,
    variant: z.enum(['short', 'standard']),
    text: z.string().min(1).max(900),
    textHash: z.string().regex(/^[a-f0-9]{64}$/),
    evidence: z
      .array(
        z.strictObject({
          id: Identifier,
          label: z.string().max(120),
          excerpt: z.string().max(400),
        }),
      )
      .min(1)
      .max(5),
    followUpAnswerIds: z.array(Identifier).max(5),
  }),
});
export const toolOutputs = {
  get_candidate_profile: ProfileOutput,
  search_interview_knowledge: SearchOutput,
  retrieve_approved_answer: AnswerOutput,
};
export const FailureCode = z.enum([
  'UNAUTHORIZED',
  'FORBIDDEN',
  'VERSION_MISMATCH',
  'UNAVAILABLE_CONTENT',
  'INVALID_INPUT',
  'TIMEOUT',
  'CANCELLED',
  'UNAVAILABLE',
  'TOO_LARGE',
  'PROTOCOL_ERROR',
]);
export type FailureCode = z.infer<typeof FailureCode>;
export const FailureOutput = z.strictObject({
  status: z.literal('error'),
  traceId: TraceId,
  code: FailureCode,
  retryable: z.boolean(),
});
export interface WireEvent {
  event: 'mcp.client';
  traceId: string;
  method: string;
  outcome: string;
  durationMs: number;
}

export const ServiceClaims = z.strictObject({
  iss: z.literal('voice-bot-gateway'),
  aud: z.literal('voice-bot-knowledge'),
  candidateId: Identifier,
  environment: Environment,
  contentVersion: Identifier,
  scopes: z.array(Scope).min(1).max(3),
  iat: z.number().int(),
  exp: z.number().int(),
  jti: z.uuid(),
});
export type ServiceClaims = z.infer<typeof ServiceClaims>;
