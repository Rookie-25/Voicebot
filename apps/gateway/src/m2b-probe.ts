// TEMPORARY M2B operator diagnostic. Remove with its route, vars and tests after proof.
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import {
  AnswerOutput,
  FailureOutput,
  MCP_REVISION,
  ProfileOutput,
  SearchOutput,
  ToolName,
  type WireEvent,
} from '@voice-bot/mcp-contracts';
import { bounded, McpFailure, readBoundedBody } from '@voice-bot/mcp-contracts/security';
import { connectKnowledge, type PrivateKnowledgeBinding } from './mcp-client';

export interface PreviewProbeEnv {
  APP_ENV?: string;
  M2B_PROBE_ENABLED?: string;
  M2B_PROBE_STARTS_AT?: string;
  M2B_PROBE_EXPIRES_AT?: string;
  M2B_OPERATOR_TOKEN?: string;
  MCP_SERVICE_SECRET?: string;
  CANDIDATE_ID?: string;
  CONTENT_VERSION?: string;
  KNOWLEDGE_MCP?: PrivateKnowledgeBinding;
}
export const ProbeCase = z.enum([
  'profile',
  'search',
  'answer',
  'answer-standard',
  'followup',
  'missing-service-auth',
  'invalid-service-auth',
  'wrong-candidate',
  'wrong-environment',
  'wrong-version',
  'wrong-tool-version',
  'insufficient-scope',
  'missing-answer',
  'invalid-tool-input',
]);
const Input = z.strictObject({ case: ProbeCase });
type Case = z.infer<typeof ProbeCase>;
const encoder = new TextEncoder();
const protocolMethods = ['initialize', 'notifications/initialized', 'tools/list', 'tools/call'];
function utc(value: string | undefined): number {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)) return NaN;
  const ms = Date.parse(value);
  return Number.isFinite(ms) && new Date(ms).toISOString().replace('.000Z', 'Z') === value
    ? ms
    : NaN;
}
function reply(status: number, code: string, traceId: string) {
  return Response.json(
    { status: 'error', code, traceId },
    {
      status,
      headers: { 'Cache-Control': 'no-store', 'X-Trace-ID': traceId },
    },
  );
}

export async function handleM2bProbe(request: Request, env: PreviewProbeEnv): Promise<Response> {
  const traceId = crypto.randomUUID();
  const now = Date.now();
  const start = utc(env.M2B_PROBE_STARTS_AT);
  const end = utc(env.M2B_PROBE_EXPIRES_AT);
  // Absolute window, not a sliding expiry renewed by every request/isolate.
  if (
    env.APP_ENV !== 'preview' ||
    env.M2B_PROBE_ENABLED !== 'true' ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start > now ||
    end <= now ||
    end <= start ||
    end - start > 3_600_000 ||
    env.CANDIDATE_ID !== 'fictional-alex' ||
    env.CONTENT_VERSION !== 'fixture-v1' ||
    !env.M2B_OPERATOR_TOKEN ||
    !/^[a-f0-9]{64}$/.test(env.M2B_OPERATOR_TOKEN)
  )
    return reply(404, 'NOT_FOUND', traceId);
  if (request.headers.has('Origin')) return reply(403, 'FORBIDDEN', traceId);
  if (request.method !== 'POST') {
    const response = reply(405, 'METHOD_NOT_ALLOWED', traceId);
    response.headers.set('Allow', 'POST');
    return response;
  }
  const credential = request.headers.get('Authorization') ?? '';
  if (
    !/^Bearer [a-f0-9]{64}$/.test(credential) ||
    !timingSafeEqual(encoder.encode(credential.slice(7)), encoder.encode(env.M2B_OPERATOR_TOKEN))
  )
    return reply(401, 'UNAUTHORIZED', traceId);
  // No client, signing or binding access occurs before operator authorization.
  if (!env.KNOWLEDGE_MCP || !env.MCP_SERVICE_SECRET || env.MCP_SERVICE_SECRET.length < 32)
    return reply(503, 'UNAVAILABLE', traceId);
  if (request.headers.get('Content-Type')?.split(';')[0]?.trim() !== 'application/json')
    return reply(415, 'INVALID_INPUT', traceId);
  try {
    return await bounded(
      async (signal) => {
        let input: z.infer<typeof Input>;
        try {
          const text = await bounded(
            (bodySignal) => readBoundedBody(request, 2048, bodySignal),
            2000,
            signal,
          );
          input = Input.parse(JSON.parse(text));
        } catch (error) {
          if (error instanceof McpFailure) throw error;
          throw new McpFailure('INVALID_INPUT');
        }
        if (Date.now() >= end) throw new McpFailure('TIMEOUT');
        return await runCase(input.case, env, traceId, signal);
      },
      Math.min(10_000, end - Date.now()),
      request.signal,
    );
  } catch (error) {
    const code = error instanceof McpFailure ? error.code : 'UNAVAILABLE';
    return reply(
      code === 'TOO_LARGE'
        ? 413
        : code === 'INVALID_INPUT'
          ? 400
          : code === 'CANCELLED'
            ? 408
            : code === 'TIMEOUT'
              ? 504
              : 503,
      code,
      traceId,
    );
  }
}

async function runCase(testCase: Case, env: PreviewProbeEnv, traceId: string, signal: AbortSignal) {
  const events: WireEvent[] = [];
  let correlated = true;
  let denial: string | undefined;
  // Fixed negative transport cases alter credentials only. SDK owns every MCP message.
  const binding: PrivateKnowledgeBinding = {
    async fetch(request) {
      const headers = new Headers(request.headers);
      if (testCase === 'missing-service-auth') headers.delete('Authorization');
      if (testCase === 'invalid-service-auth')
        headers.set('Authorization', 'Bearer invalid-m2b-test');
      const response = await env.KNOWLEDGE_MCP!.fetch(new Request(request, { headers }));
      correlated &&= response.headers.get('X-Trace-ID') === traceId;
      if ([401, 403].includes(response.status)) {
        const parsed = FailureOutput.safeParse(
          await response
            .clone()
            .json()
            .catch(() => null),
        );
        if (
          parsed.success &&
          parsed.data.traceId === traceId &&
          ((response.status === 401 && parsed.data.code === 'UNAUTHORIZED') ||
            (response.status === 403 &&
              ['FORBIDDEN', 'VERSION_MISMATCH'].includes(parsed.data.code)))
        )
          denial = parsed.data.code;
      }
      return response;
    },
  };
  let connection: Awaited<ReturnType<typeof connectKnowledge>> | undefined;
  let outcome: string;
  let contentValid = false;
  try {
    connection = await connectKnowledge({
      binding,
      secret: env.MCP_SERVICE_SECRET!,
      traceId,
      signal,
      candidateId: testCase === 'wrong-candidate' ? 'fictional-river' : env.CANDIDATE_ID!,
      environment: testCase === 'wrong-environment' ? 'local' : 'preview',
      contentVersion: testCase === 'wrong-version' ? 'fixture-missing' : env.CONTENT_VERSION!,
      ...(testCase === 'insufficient-scope' ? { scopes: ['profile:read'] } : {}),
      onTrace: (event) => events.push(event),
    });
    const version = env.CONTENT_VERSION!;
    if (testCase === 'profile') {
      const output = ProfileOutput.parse(
        await connection.call('get_candidate_profile', { version, sections: ['background'] }),
      );
      contentValid = output.synthetic && output.data.fields.some((field) => field.id === 'intro');
    } else if (testCase === 'search') {
      const output = SearchOutput.parse(
        await connection.call('search_interview_knowledge', {
          version,
          query: 'fictional',
          kinds: ['project', 'story', 'answer', 'evidence'],
          limit: 5,
        }),
      );
      contentValid =
        output.synthetic && output.data.matches.some((match) => match.id === 'sample-project');
    } else if (testCase === 'wrong-tool-version') {
      await connection.call('get_candidate_profile', {
        version: 'fixture-missing',
        sections: ['background'],
      });
    } else {
      const answerId =
        testCase === 'missing-answer' ? 'missing' : testCase === 'followup' ? 'followup' : 'intro';
      const variant = testCase === 'answer-standard' ? 'standard' : 'short';
      let output;
      try {
        output = AnswerOutput.parse(
          await connection.call('retrieve_approved_answer', {
            version,
            answerId: testCase === 'invalid-tool-input' ? '../invalid' : answerId,
            variant,
          }),
        );
      } catch (error) {
        // This case intentionally proves the existing client schema gate. M2A
        // separately verifies server-side invalid schema rejection over the wire.
        if (testCase === 'invalid-tool-input' && error instanceof z.ZodError)
          throw new McpFailure('INVALID_INPUT');
        throw error;
      }
      const hash = Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(output.data.text))),
        (byte) => byte.toString(16).padStart(2, '0'),
      ).join('');
      contentValid =
        output.synthetic &&
        output.data.answerId === answerId &&
        output.data.variant === variant &&
        output.data.textHash === hash &&
        output.data.evidence.some((item) => item.id === 'sample-evidence') &&
        (testCase === 'followup' || output.data.followUpAnswerIds.includes('followup'));
    }
    outcome = 'OK';
  } catch (error) {
    outcome = signal.aborted
      ? 'CANCELLED'
      : (denial ?? (error instanceof McpFailure ? error.code : 'UNAVAILABLE'));
  } finally {
    await connection?.close().catch(() => undefined);
  }
  signal.throwIfAborted();
  const expected: Partial<Record<Case, string>> = {
    'missing-service-auth': 'UNAUTHORIZED',
    'invalid-service-auth': 'UNAUTHORIZED',
    'wrong-candidate': 'FORBIDDEN',
    'wrong-environment': 'FORBIDDEN',
    'wrong-version': 'VERSION_MISMATCH',
    'wrong-tool-version': 'VERSION_MISMATCH',
    'insufficient-scope': 'FORBIDDEN',
    'missing-answer': 'UNAVAILABLE_CONTENT',
    'invalid-tool-input': 'INVALID_INPUT',
  };
  const transportDenied = [
    'missing-service-auth',
    'invalid-service-auth',
    'wrong-candidate',
    'wrong-environment',
    'wrong-version',
  ].includes(testCase);
  const methods = protocolMethods.filter((method) =>
    events.some((event) => event.method === method),
  );
  const negotiated =
    connection?.revision === MCP_REVISION && Boolean(connection.capabilities?.tools);
  const catalogValid =
    connection?.tools.length === 3 &&
    connection.tools.every((tool) => ToolName.safeParse(tool.name).success);
  const protocolValid = transportDenied
    ? methods.includes('initialize')
    : negotiated &&
      catalogValid &&
      protocolMethods
        .filter((method) => testCase !== 'invalid-tool-input' || method !== 'tools/call')
        .every((method) => methods.includes(method));
  const traceValid =
    correlated && events.length > 0 && events.every((event) => event.traceId === traceId);
  const passed = Boolean(
    protocolValid &&
    traceValid &&
    outcome === (expected[testCase] ?? 'OK') &&
    (expected[testCase] || contentValid),
  );
  // Explicit allowlist projection: no tool output, text, hash, error.message or raw events escape.
  const report = {
    status: passed ? 'passed' : 'failed',
    case: testCase,
    traceId,
    outcome,
    revision: connection?.revision ?? null,
    methods,
    tools: connection?.tools.map((tool) => ToolName.parse(tool.name)) ?? [],
    checks: {
      protocol: Boolean(protocolValid),
      trace: traceValid,
      content: contentValid,
      expectedOutcome: outcome === (expected[testCase] ?? 'OK'),
    },
  };
  console.log(
    JSON.stringify({ event: 'm2b.probe', traceId, case: testCase, status: report.status, outcome }),
  );
  return Response.json(report, {
    status: passed ? 200 : 502,
    headers: { 'Cache-Control': 'no-store', 'X-Trace-ID': traceId },
  });
}
