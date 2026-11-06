import { z } from 'zod';
import {
  ApiErrorSchema,
  AppConfigSchema,
  TurnInputSchema,
  TurnResponseSchema,
} from '@voice-bot/contracts';
import { AnswerOutput, SearchOutput } from '@voice-bot/mcp-contracts';
import { bounded, McpFailure, readBoundedBody } from '@voice-bot/mcp-contracts/security';
import { connectKnowledge, type PrivateKnowledgeBinding } from './mcp-client';
import { openAiSelector, testSelector } from './model';
import { privateIpHash, sign, verify } from './session';

export interface TurnEnv {
  APP_ENV?: 'local' | 'preview' | 'production';
  LIVE_AI_ENABLED?: string;
  LOCAL_TEST_PROVIDER?: string;
  OPENAI_API_KEY?: string;
  LLM_MODEL?: string;
  SESSION_SECRET?: string;
  MCP_SERVICE_SECRET?: string;
  CANDIDATE_ID?: string;
  CONTENT_VERSION?: string;
  CONTENT_MODE?: string;
  DAILY_BUDGET_CENTS?: string;
  KNOWLEDGE_MCP?: PrivateKnowledgeBinding;
  BUDGET?: DurableObjectNamespace;
}
const Session = z.strictObject({ sid: z.uuid(), exp: z.number().int() });
const Context = Session.extend({
  candidate: z.string().max(80),
  version: z.string().max(80),
  answerId: z.string().max(80).nullable(),
});
const fallback =
  "I don't have an approved answer for that question yet. Please ask about my background, projects, or an experience I've provided.";
class QuotaDenied extends Error {}
function provider(env: TurnEnv) {
  if (env.APP_ENV === 'local' && env.LOCAL_TEST_PROVIDER === 'true') return 'test' as const;
  if (env.LIVE_AI_ENABLED === 'true' && env.OPENAI_API_KEY && env.LLM_MODEL === 'gpt-5.6-terra')
    return 'openai' as const;
  return 'disabled' as const;
}
export function appConfig(env: TurnEnv) {
  const selected = provider(env);
  const cap = Number(env.DAILY_BUDGET_CENTS);
  const available =
    selected !== 'disabled' &&
    Boolean(
      Number.isInteger(cap) &&
      cap >= 1 &&
      cap <= 100 &&
      env.SESSION_SECRET &&
      env.SESSION_SECRET.length >= 32 &&
      env.MCP_SERVICE_SECRET &&
      env.KNOWLEDGE_MCP &&
      env.BUDGET &&
      env.CANDIDATE_ID &&
      env.CONTENT_VERSION,
    );
  return AppConfigSchema.parse({
    available,
    provider: selected,
    fictional: env.CONTENT_MODE !== 'approved',
  });
}
function error(
  code:
    | 'INVALID_REQUEST'
    | 'FORBIDDEN'
    | 'RATE_LIMITED'
    | 'UNAVAILABLE'
    | 'TIMEOUT'
    | 'METHOD_NOT_ALLOWED',
  id: string,
  status: number,
) {
  const messages = {
    INVALID_REQUEST: 'Please enter a valid question, up to 2,000 characters.',
    FORBIDDEN: 'This request could not be verified. Reset the conversation and try again.',
    RATE_LIMITED: 'The interview limit has been reached. Please try again later.',
    UNAVAILABLE: 'Live answers are not available right now. Please try again later.',
    TIMEOUT: 'The answer took too long. Please try again.',
    METHOD_NOT_ALLOWED: 'Use POST.',
  };
  return Response.json(
    ApiErrorSchema.parse({
      error: {
        code,
        message: messages[code],
        requestId: id,
        retryable: ['TIMEOUT', 'UNAVAILABLE'].includes(code),
      },
    }),
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
        'X-Trace-ID': id,
        ...(status === 405 ? { Allow: 'POST' } : {}),
        ...(status === 429 ? { 'Retry-After': '60' } : {}),
      },
    },
  );
}
function searchTopic(question: string) {
  if (/yourself|introduc|background/i.test(question)) return 'introduction';
  for (const topic of ['project', 'strength', 'challenge', 'goal'])
    if (question.toLowerCase().includes(topic)) return topic;
  if (/team|working style/i.test(question)) return 'working';
  return (
    question
      .normalize('NFKC')
      .match(/[\p{L}\p{N}]{4,}/u)?.[0]
      ?.slice(0, 80) ?? ''
  );
}
export async function handleTurn(request: Request, env: TurnEnv): Promise<Response> {
  const id = crypto.randomUUID();
  if (request.method !== 'POST') return error('METHOD_NOT_ALLOWED', id, 405);
  if (!appConfig(env).available) return error('UNAVAILABLE', id, 503);
  const origin = request.headers.get('Origin'),
    url = new URL(request.url);
  const localOrigins = ['http://127.0.0.1:5173', 'http://localhost:5173'];
  if (
    (origin !== url.origin &&
      !(env.APP_ENV === 'local' && origin && localOrigins.includes(origin))) ||
    (request.headers.has('Sec-Fetch-Site') &&
      !['same-origin', 'same-site'].includes(request.headers.get('Sec-Fetch-Site')!))
  )
    return error('FORBIDDEN', id, 403);
  if (request.headers.get('Content-Type')?.split(';')[0]?.trim() !== 'application/json')
    return error('INVALID_REQUEST', id, 415);
  const selected = provider(env);
  if (selected === 'disabled') return error('UNAVAILABLE', id, 503);
  const secret = env.SESSION_SECRET!;
  let budget: DurableObjectStub | undefined,
    reserved = false;
  let cookie = '';
  let result: Response;
  try {
    result = await bounded(
      async (signal) => {
        let input;
        try {
          input = TurnInputSchema.parse(
            JSON.parse(await bounded((s) => readBoundedBody(request, 12_288, s), 2000, signal)),
          );
        } catch (e) {
          if (e instanceof McpFailure) throw e;
          throw new McpFailure('INVALID_INPUT');
        }
        const now = Math.floor(Date.now() / 1000);
        let session = { sid: crypto.randomUUID(), exp: now + 3600 };
        const token = request.headers
          .get('Cookie')
          ?.match(/(?:^|;\s*)voice_session=([A-Za-z0-9_.-]+)/)?.[1];
        if (token) {
          try {
            const parsed = Session.parse(await verify(token, secret));
            if (parsed.exp > now && parsed.exp <= now + 3600) session = parsed;
          } catch {
            /* Expired/invalid sessions receive a new bounded identity. */
          }
        }
        cookie = `voice_session=${await sign(session, secret)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600${url.protocol === 'https:' ? '; Secure' : ''}`;
        let previousId: string | null = null;
        if (input.context) {
          try {
            const ctx = Context.parse(await verify(input.context, secret));
            if (
              ctx.sid !== session.sid ||
              ctx.exp <= now ||
              ctx.exp > now + 3600 ||
              ctx.candidate !== env.CANDIDATE_ID ||
              ctx.version !== env.CONTENT_VERSION
            )
              throw new Error();
            previousId = ctx.answerId;
          } catch {
            throw new McpFailure('FORBIDDEN');
          }
        }
        const ip =
          request.headers.get('CF-Connecting-IP') ?? (env.APP_ENV === 'local' ? '127.0.0.1' : '');
        if (!ip || ip.length > 64) throw new McpFailure('FORBIDDEN');
        budget = env.BUDGET!.get(env.BUDGET!.idFromName('interview-global-v1'));
        const ipHash = await privateIpHash(ip, secret);
        const grant = await bounded(
          () =>
            budget!.fetch('https://budget.internal', {
              method: 'POST',
              body: JSON.stringify({ operation: 'reserve', id, session: session.sid, ip: ipHash }),
            }),
          1000,
          signal,
        );
        if (grant.status === 429) throw new QuotaDenied();
        if (grant.status !== 204) throw new McpFailure('UNAVAILABLE');
        reserved = true;
        const connection = await connectKnowledge({
          scopes: ['knowledge:search', 'answers:read'],
          binding: env.KNOWLEDGE_MCP!,
          secret: env.MCP_SERVICE_SECRET!,
          candidateId: env.CANDIDATE_ID!,
          contentVersion: env.CONTENT_VERSION!,
          environment: env.APP_ENV!,
          traceId: id,
          signal,
        });
        try {
          const version = env.CONTENT_VERSION!;
          let previous = '';
          let followUps: string[] = [];
          if (previousId) {
            const p = AnswerOutput.parse(
              await connection.call('retrieve_approved_answer', {
                version,
                answerId: previousId,
                variant: 'short',
              }),
            );
            previous = p.data.text;
            followUps = p.data.followUpAnswerIds;
          }
          const query = searchTopic(input.question);
          let catalog = SearchOutput.parse(
            await connection.call('search_interview_knowledge', {
              version,
              query,
              kinds: ['answer'],
              limit: 5,
            }),
          );
          if (!catalog.data.matches.length && query)
            catalog = SearchOutput.parse(
              await connection.call('search_interview_knowledge', {
                version,
                query: '',
                kinds: ['answer'],
                limit: 5,
              }),
            );
          const options = catalog.data.matches.map((item) => ({
            id: item.id,
            title: item.title,
            summary: item.summary,
          }));
          for (const next of followUps)
            if (!options.some((o) => o.id === next))
              options.push({
                id: next,
                title: 'Approved follow-up',
                summary: 'Approved continuation of the previous answer.',
              });
          const selector =
            selected === 'test'
              ? testSelector
              : openAiSelector(env.OPENAI_API_KEY!, env.LLM_MODEL!);
          const answerId = options.length
            ? await selector.select(
                { question: input.question, options, previous, followUps },
                signal,
              )
            : null;
          if (answerId !== null && !options.some((o) => o.id === answerId))
            throw new McpFailure('PROTOCOL_ERROR');
          let text = fallback,
            fictional = catalog.synthetic,
            grounded = false,
            next = false,
            accepted: string | null = null;
          if (answerId) {
            try {
              const answer = AnswerOutput.parse(
                await connection.call('retrieve_approved_answer', {
                  version,
                  answerId,
                  variant: input.length === 'concise' ? 'short' : 'standard',
                }),
              );
              text = answer.data.text;
              fictional = answer.synthetic;
              grounded = true;
              accepted = answerId;
              next = answer.data.followUpAnswerIds.length > 0;
            } catch (e) {
              if (!(e instanceof McpFailure) || e.code !== 'UNAVAILABLE_CONTENT') throw e;
            }
          }
          const context = await sign(
            {
              sid: session.sid,
              exp: session.exp,
              candidate: env.CANDIDATE_ID!,
              version,
              answerId: accepted,
            },
            secret,
          );
          return Response.json(
            TurnResponseSchema.parse({
              requestId: id,
              answer: text,
              answerId: accepted,
              contentVersion: version,
              fictional,
              provider: selected,
              grounded,
              context,
              followUpAvailable: next,
            }),
            { headers: { 'Cache-Control': 'no-store', 'X-Trace-ID': id } },
          );
        } finally {
          await connection.close().catch(() => undefined);
        }
      },
      20_000,
      request.signal,
    );
  } catch (e) {
    const code = e instanceof McpFailure ? e.code : 'UNAVAILABLE';
    result =
      e instanceof QuotaDenied
        ? error('RATE_LIMITED', id, 429)
        : code === 'TOO_LARGE'
          ? error('INVALID_REQUEST', id, 413)
          : code === 'INVALID_INPUT'
            ? error('INVALID_REQUEST', id, 400)
            : code === 'FORBIDDEN'
              ? error('FORBIDDEN', id, 403)
              : code === 'TIMEOUT'
                ? error('TIMEOUT', id, 504)
                : error('UNAVAILABLE', id, 503);
  } finally {
    if (reserved && budget)
      await bounded(
        () =>
          budget!.fetch('https://budget.internal', {
            method: 'POST',
            body: JSON.stringify({ operation: 'release', id }),
          }),
        1000,
      ).catch(() => undefined);
  }
  if (cookie) result.headers.set('Set-Cookie', cookie);
  console.log(
    JSON.stringify({ event: 'turn', requestId: id, status: result.status, provider: selected }),
  );
  return result;
}
