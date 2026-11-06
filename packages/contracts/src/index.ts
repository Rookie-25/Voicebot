import { z } from 'zod';

export const ConversationStateSchema = z.enum([
  'idle',
  'listening',
  'processing',
  'speaking',
  'stopped',
  'error',
]);
export type ConversationState = z.infer<typeof ConversationStateSchema>;

export const RequestIdSchema = z.uuid();
export const UserQuestionSchema = z.strictObject({
  requestId: RequestIdSchema,
  text: z.string().trim().min(1).max(2000),
});
export type UserQuestion = z.infer<typeof UserQuestionSchema>;

export const ApprovedAnswerReferenceSchema = z.strictObject({
  answerId: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
  contentVersion: z.string().min(1).max(80),
  variant: z.enum(['short', 'standard']),
});
export type ApprovedAnswerReference = z.infer<typeof ApprovedAnswerReferenceSchema>;

export const ApiErrorSchema = z.strictObject({
  error: z.strictObject({
    code: z.enum([
      'NOT_FOUND',
      'NOT_IMPLEMENTED',
      'METHOD_NOT_ALLOWED',
      'INVALID_REQUEST',
      'UNAVAILABLE',
      'FORBIDDEN',
      'RATE_LIMITED',
      'TIMEOUT',
    ]),
    message: z.string().min(1).max(300),
    requestId: RequestIdSchema,
    retryable: z.boolean(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const HealthResponseSchema = z.strictObject({
  status: z.literal('ok'),
  service: z.enum(['gateway', 'knowledge-mcp']),
  version: z.literal('0.1.0'),
  milestone: z.enum(['M1', 'M2A']),
  mode: z.enum(['skeleton', 'mcp']),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const TurnInputSchema = z.strictObject({
  question: z.string().trim().min(1).max(2000),
  length: z.enum(['concise', 'standard']).default('concise'),
  context: z.string().max(3000).optional(),
});
export type TurnInput = z.infer<typeof TurnInputSchema>;
export const TurnResponseSchema = z.strictObject({
  requestId: RequestIdSchema,
  answer: z.string().min(1).max(900),
  answerId: z.string().max(80).nullable(),
  contentVersion: z.string().max(80),
  fictional: z.boolean(),
  provider: z.enum(['openai', 'test']),
  grounded: z.boolean(),
  context: z.string().max(3000),
  followUpAvailable: z.boolean(),
});
export type TurnResponse = z.infer<typeof TurnResponseSchema>;
export const AppConfigSchema = z.strictObject({
  available: z.boolean(),
  fictional: z.boolean(),
  provider: z.enum(['openai', 'test', 'disabled']),
});
