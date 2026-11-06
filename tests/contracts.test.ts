import { describe, expect, it } from 'vitest';
import {
  ApprovedAnswerReferenceSchema,
  HealthResponseSchema,
  RequestIdSchema,
  UserQuestionSchema,
} from '@voice-bot/contracts';

describe('public contracts', () => {
  it('normalizes questions and rejects empty, oversized, and extra fields', () => {
    const requestId = crypto.randomUUID();
    expect(UserQuestionSchema.parse({ requestId, text: '  A question?  ' }).text).toBe(
      'A question?',
    );
    expect(UserQuestionSchema.safeParse({ requestId, text: ' ' }).success).toBe(false);
    expect(UserQuestionSchema.safeParse({ requestId, text: 'x'.repeat(2001) }).success).toBe(false);
    expect(
      UserQuestionSchema.safeParse({ requestId, text: 'Hello', apiKey: 'forbidden' }).success,
    ).toBe(false);
    expect(RequestIdSchema.safeParse('arbitrary-client-string').success).toBe(false);
  });
  it('does not let answer references carry arbitrary text or paths', () => {
    expect(
      ApprovedAnswerReferenceSchema.safeParse({
        answerId: '../private',
        contentVersion: 'v1',
        variant: 'short',
      }).success,
    ).toBe(false);
    expect(
      ApprovedAnswerReferenceSchema.safeParse({
        answerId: 'intro',
        contentVersion: 'v1',
        variant: 'short',
        text: 'unapproved',
      }).success,
    ).toBe(false);
  });
  it('makes health responses explicitly identify the skeleton', () => {
    expect(
      HealthResponseSchema.safeParse({
        status: 'ok',
        service: 'gateway',
        version: '0.1.0',
        milestone: 'M1',
        mode: 'production-ai',
      }).success,
    ).toBe(false);
  });
});
