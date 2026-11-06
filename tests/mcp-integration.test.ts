import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  MCP_REVISION,
  READ_SCOPES,
  ServiceClaims,
  AnswerOutput,
  ProfileOutput,
  SearchOutput,
  type WireEvent,
} from '@voice-bot/mcp-contracts';
import { signServiceToken } from '@voice-bot/mcp-contracts/security';
import { connectKnowledge } from '../apps/gateway/src/mcp-client';

const secret = 'synthetic-integration-test-secret-never-use-in-cloud-0001';
const version = 'fixture-v1';
let runtime: Miniflare;
const openClients: Client[] = [];
const driver = `export default { async fetch(request, env) {
  if (new URL(request.url).pathname === '/slow-body') {
    const headers = new Headers(request.headers); headers.set('Host','knowledge.internal');
    const body = new ReadableStream({ pull() { return new Promise(() => {}); } });
    return env.KNOWLEDGE.fetch(new Request('https://knowledge.internal/mcp', { method:'POST', headers, body }));
  }
  const result = await env.GATEWAY.probe(await request.json()); return Response.json(result);
} };`;
// Miniflare's Node getWorker proxy rewrites Host to its loopback address.
// This test-only relay restores the canonical internal request before crossing
// a real Worker HTTP service binding; production does not allow loopback Hosts.
const relay = `export default { fetch(request, env) { const headers = new Headers(request.headers); headers.set('Host','knowledge.internal'); return env.KNOWLEDGE.fetch(new Request('https://knowledge.internal/mcp', { method: request.method, headers, body: request.body, signal: request.signal })); } };`;
// Normalize Node/undici and Worker Request/Response realms at the test boundary.
// Production uses the native Fetcher binding directly, without this adapter.
async function localFetch(
  worker: Awaited<ReturnType<Miniflare['getWorker']>>,
  request: Request,
): Promise<Response> {
  const response = await worker.fetch(request.url, {
    method: request.method,
    headers: (() => {
      const values: Record<string, string> = {};
      request.headers.forEach((value, key) => {
        values[key] = value;
      });
      return values;
    })(),
    ...(request.method === 'POST' ? { body: await request.arrayBuffer() } : {}),
  });
  return new Response(
    response.status === 204 || response.status === 304 ? null : await response.arrayBuffer(),
    {
      status: response.status,
      headers: (() => {
        const values: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          values[key] = value;
        });
        return values;
      })(),
    },
  );
}
function claims(overrides: Partial<ServiceClaims> = {}): ServiceClaims {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: 'voice-bot-gateway',
    aud: 'voice-bot-knowledge',
    candidateId: 'fictional-alex',
    environment: 'local',
    contentVersion: version,
    scopes: [...READ_SCOPES],
    iat: now,
    exp: now + 60,
    jti: crypto.randomUUID(),
    ...overrides,
  };
}
async function rawClient(
  overrides: Partial<ServiceClaims> = {},
  auth: 'valid' | 'missing' | 'invalid' = 'valid',
  target = 'knowledge-a',
) {
  const worker = await runtime.getWorker('relay-' + target);
  const traceId = crypto.randomUUID();
  const requests: { method: string; status: number; traceId: string | null }[] = [];
  const client = new Client(
    { name: 'official-sdk-integration-test', version: '0.2.0' },
    { supportedProtocolVersions: [MCP_REVISION], versionNegotiation: { mode: 'legacy' } },
  );
  openClients.push(client);
  const transport = new StreamableHTTPClientTransport(new URL('https://knowledge.internal/mcp'), {
    fetch: async (input, init) => {
      const request = new Request(input, init);
      const body = request.method === 'POST' ? await request.clone().json() : { method: 'GET' };
      const headers = new Headers(request.headers);
      headers.set('Host', 'knowledge.internal');
      headers.set('x-trace-id', traceId);
      if (auth !== 'missing')
        headers.set(
          'Authorization',
          'Bearer ' +
            (auth === 'valid' ? await signServiceToken(claims(overrides), secret) : 'invalid'),
        );
      const response = await localFetch(worker, new Request(request, { headers }));
      requests.push({
        method: body.method,
        status: response.status,
        traceId: response.headers.get('x-trace-id'),
      });
      return response;
    },
  });
  return { client, traceId, requests, connect: () => client.connect(transport) };
}

beforeAll(async () => {
  const common = {
    modules: true as const,
    compatibilityDate: '2026-11-06',
    compatibilityFlags: ['nodejs_compat'],
  };
  const bindings = {
    APP_ENV: 'local',
    MCP_SERVICE_SECRET: secret,
    CONTENT_VERSION: version,
    ALLOW_SYNTHETIC_DATA: 'true',
  };
  runtime = new Miniflare(
    convertV4MiniflareOptions({
      host: '127.0.0.1',
      port: 0,
      workers: [
        ...['knowledge-a', 'knowledge-b', 'knowledge-production'].map((name) => ({
          ...common,
          name: 'relay-' + name,
          script: relay,
          serviceBindings: { KNOWLEDGE: name },
        })),
        {
          ...common,
          name: 'driver',
          script: driver,
          serviceBindings: {
            GATEWAY: { name: 'gateway', entrypoint: 'McpDiagnostics' },
            KNOWLEDGE: 'knowledge-a',
          },
        },
        {
          ...common,
          name: 'gateway',
          scriptPath: resolve('apps/gateway/dist/index.js'),
          bindings: { ...bindings, CANDIDATE_ID: 'fictional-alex', LOCAL_MCP_DIAGNOSTICS: 'true' },
          serviceBindings: { KNOWLEDGE_MCP: 'knowledge-a' },
        },
        {
          ...common,
          name: 'knowledge-a',
          scriptPath: resolve('apps/knowledge-mcp/dist/index.js'),
          bindings: { ...bindings, CANDIDATE_ID: 'fictional-alex' },
          d1Databases: { DB: 'm2a-test-alex' },
        },
        {
          ...common,
          name: 'knowledge-b',
          scriptPath: resolve('apps/knowledge-mcp/dist/index.js'),
          bindings: { ...bindings, CANDIDATE_ID: 'fictional-river' },
          d1Databases: { DB: 'm2a-test-river' },
        },
        {
          ...common,
          name: 'knowledge-production',
          scriptPath: resolve('apps/knowledge-mcp/dist/index.js'),
          bindings: {
            ...bindings,
            APP_ENV: 'production',
            CANDIDATE_ID: 'fictional-alex',
            ALLOW_SYNTHETIC_DATA: 'true',
          },
          d1Databases: { DB: 'm2a-test-production' },
        },
      ],
    }),
  );
  await runtime.ready;
  for (const worker of ['knowledge-a', 'knowledge-b', 'knowledge-production']) {
    const db = await runtime.getD1Database('DB', worker);
    for (const file of [
      'apps/knowledge-mcp/migrations/0001_approved_knowledge.sql',
      'tests/fixtures/fictional-knowledge.sql',
    ]) {
      // Execute whole SQL statements, preserving multiline views and comments.
      const sql = readFileSync(file, 'utf8').replace(/^--.*$/gm, '');
      for (const statement of sql.split(';').filter((value) => value.trim()))
        await db.prepare(statement).run();
    }
  }
}, 30000);
afterAll(async () => {
  await Promise.all(openClients.map((client) => client.close().catch(() => undefined)));
  await runtime?.dispose();
});

describe('genuine MCP in local Workers', () => {
  it('treats search wildcards and SQL-like strings as bounded literal input', async () => {
    const peer = await rawClient();
    await peer.connect();
    for (const query of ['%', "' OR 1=1 --"]) {
      const result = await peer.client.callTool({
        name: 'search_interview_knowledge',
        arguments: { version, query, kinds: ['answer', 'project', 'story', 'evidence'], limit: 5 },
      });
      expect(SearchOutput.parse(result.structuredContent).data.matches).toEqual([]);
    }
  });
  it('rejects browser origins, oversized payloads and an unsupported protocol revision', async () => {
    const worker = await runtime.getWorker('relay-knowledge-a');
    const token = await signServiceToken(claims(), secret);
    for (const [extraHeaders, body, status] of [
      [
        { Origin: 'https://untrusted.example' },
        JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
        403,
      ],
      [{}, 'x'.repeat(9000), 413],
      [
        {},
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: { protocolVersion: '2024-11-05' },
        }),
        400,
      ],
    ] as const) {
      const response = await worker.fetch('https://knowledge.internal/mcp', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          'MCP-Protocol-Version': MCP_REVISION,
          ...extraHeaders,
        },
        body,
      });
      expect(response.status).toBe(status);
      const text = await response.text();
      expect(text).not.toContain(secret);
      expect(text).not.toMatch(/SELECT|stack|node_modules/);
    }
  });
  it('enforces the server deadline on a stalled upload made by an official SDK client', async () => {
    const worker = await runtime.getWorker('driver');
    const client = new Client(
      { name: 'slow-upload-test', version: '1' },
      { supportedProtocolVersions: [MCP_REVISION], versionNegotiation: { mode: 'legacy' } },
    );
    openClients.push(client);
    let status = 0;
    const transport = new StreamableHTTPClientTransport(
      new URL('https://driver.internal/slow-body'),
      {
        fetch: async (input, init) => {
          const headers = new Headers(init?.headers);
          headers.set('Authorization', `Bearer ${await signServiceToken(claims(), secret)}`);
          headers.set('x-trace-id', crypto.randomUUID());
          const response = await localFetch(worker, new Request(input, { ...init, headers }));
          status = response.status;
          return response;
        },
      },
    );
    await expect(client.connect(transport)).rejects.toThrow();
    expect(status).toBe(504);
  }, 10000);
  it('rejects a version that was revoked after initialization', async () => {
    const peer = await rawClient();
    await peer.connect();
    const db = await runtime.getD1Database('DB', 'knowledge-a');
    try {
      await db
        .prepare(
          "UPDATE content_versions SET state='revoked' WHERE candidate_id='fictional-alex' AND id='fixture-v1'",
        )
        .run();
      const result = await peer.client.callTool({
        name: 'get_candidate_profile',
        arguments: { version, sections: ['background'] },
      });
      expect(result.structuredContent).toMatchObject({ code: 'VERSION_MISMATCH' });
    } finally {
      await db
        .prepare(
          "UPDATE content_versions SET state='published' WHERE candidate_id='fictional-alex' AND id='fixture-v1'",
        )
        .run();
    }
  });
  it('runs the gateway official client across the actual private HTTP service binding', async () => {
    const worker = await runtime.getWorker('driver');
    const response = await worker.fetch('https://driver.internal/probe', {
      method: 'POST',
      body: JSON.stringify({
        tool: 'retrieve_approved_answer',
        input: { version, answerId: 'intro', variant: 'short' },
      }),
    });
    expect(response.status).toBe(200);
    const proof = (await response.json()) as {
      revision: string;
      capabilities: { tools: unknown };
      tools: string[];
      result: unknown;
      events: WireEvent[];
    };
    expect(proof.revision).toBe(MCP_REVISION);
    expect(proof.capabilities.tools).toBeDefined();
    expect(proof.tools.sort()).toEqual([
      'get_candidate_profile',
      'retrieve_approved_answer',
      'search_interview_knowledge',
    ]);
    const result = AnswerOutput.parse(proof.result);
    expect(result.data.text).toContain('SYNTHETIC FIXTURE');
    expect(result.data.followUpAnswerIds).toEqual(['followup']);
    expect(proof.events.map((event) => event.method)).toEqual(
      expect.arrayContaining([
        'initialize',
        'notifications/initialized',
        'tools/list',
        'tools/call',
      ]),
    );
    expect(proof.events.every((event) => event.traceId === result.traceId)).toBe(true);
    expect(JSON.stringify(proof.events)).not.toContain(secret);
  });
  it('negotiates the pinned revision, discovers strict schemas and invokes all tools', async () => {
    const peer = await rawClient();
    await peer.connect();
    expect(peer.client.getNegotiatedProtocolVersion()).toBe(MCP_REVISION);
    const catalog = await peer.client.listTools();
    expect(catalog.tools).toHaveLength(3);
    for (const tool of catalog.tools) {
      expect(tool.inputSchema.additionalProperties).toBe(false);
      expect(tool.annotations?.readOnlyHint).toBe(true);
    }
    const profile = await peer.client.callTool({
      name: 'get_candidate_profile',
      arguments: { version, sections: ['background', 'goals'] },
    });
    expect(ProfileOutput.parse(profile.structuredContent).data.fields).toHaveLength(1);
    const search = await peer.client.callTool({
      name: 'search_interview_knowledge',
      arguments: {
        version,
        query: 'fictional',
        kinds: ['project', 'story', 'answer', 'evidence'],
        limit: 5,
      },
    });
    expect(SearchOutput.parse(search.structuredContent).data.matches.length).toBeGreaterThan(0);
    const text = JSON.stringify([profile, search]);
    expect(text).not.toMatch(
      /UNPUBLISHED_FIXTURE_SECRET|DRAFT_FIXTURE_SECRET|UNAPPROVED_FIXTURE_SECRET/,
    );
    expect(peer.requests.every((request) => request.traceId === peer.traceId)).toBe(true);
  });
  it('rejects invalid schema input through the real protocol', async () => {
    const peer = await rawClient();
    await peer.connect();
    await peer.client.listTools();
    const result = await peer.client.callTool({
      name: 'retrieve_approved_answer',
      arguments: { version, answerId: '../private', variant: 'short', extra: 'rejected' },
    });
    expect(result.isError).toBe(true);
    expect(peer.requests.some((request) => request.method === 'tools/call')).toBe(true);
  });
  it('rejects missing, invalid, expired and mis-scoped service credentials', async () => {
    for (const [overrides, auth, status] of [
      [{}, 'missing', 401],
      [{}, 'invalid', 401],
      [{ iat: 1, exp: 2 }, 'valid', 401],
      [{ candidateId: 'fictional-river' }, 'valid', 403],
      [{ environment: 'preview' }, 'valid', 403],
      [{ contentVersion: 'fixture-draft' }, 'valid', 403],
    ] as const) {
      const peer = await rawClient(overrides, auth);
      await expect(peer.connect()).rejects.toThrow();
      expect(peer.requests[0]?.status).toBe(status);
    }
  });
  it('enforces per-tool permission and refuses missing, draft or private-evidence answers', async () => {
    const restricted = await rawClient({ scopes: ['profile:read'] });
    await restricted.connect();
    const denied = await restricted.client.callTool({
      name: 'retrieve_approved_answer',
      arguments: { version, answerId: 'intro', variant: 'short' },
    });
    expect(denied.structuredContent).toMatchObject({ code: 'FORBIDDEN' });
    const peer = await rawClient();
    await peer.connect();
    for (const [answerId, variant] of [
      ['missing', 'short'],
      ['unapproved', 'short'],
      ['blocked-evidence', 'short'],
      ['intro', 'standard'],
    ]) {
      const result = await peer.client.callTool({
        name: 'retrieve_approved_answer',
        arguments: { version, answerId, variant },
      });
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toMatchObject({ code: 'UNAVAILABLE_CONTENT' });
    }
    const wrongVersion = await peer.client.callTool({
      name: 'get_candidate_profile',
      arguments: { version: 'fixture-draft', sections: ['background'] },
    });
    expect(wrongVersion.structuredContent).toMatchObject({ code: 'VERSION_MISMATCH' });
  });
  it('isolates parallel candidates, versions and trace identifiers', async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, async (_, index) => {
        const river = index % 2 === 1;
        const peer = await rawClient(
          { candidateId: river ? 'fictional-river' : 'fictional-alex' },
          'valid',
          river ? 'knowledge-b' : 'knowledge-a',
        );
        await peer.connect();
        const result = await peer.client.callTool({
          name: 'retrieve_approved_answer',
          arguments: { version, answerId: 'intro', variant: 'short' },
        });
        const answer = AnswerOutput.parse(result.structuredContent);
        expect(answer.candidateId).toBe(river ? 'fictional-river' : 'fictional-alex');
        expect(answer.data.text).toContain(river ? 'River' : 'Alex');
        expect(answer.traceId).toBe(peer.traceId);
        return answer;
      }),
    );
    expect(new Set(results.map((result) => result.traceId)).size).toBe(8);
  });
  it('forbids synthetic records in production even if the fixture flag is set', async () => {
    const peer = await rawClient({ environment: 'production' }, 'valid', 'knowledge-production');
    await peer.connect();
    const result = await peer.client.callTool({
      name: 'get_candidate_profile',
      arguments: { version, sections: ['background'] },
    });
    expect(result.structuredContent).toMatchObject({ code: 'FORBIDDEN' });
  });
  it('bounds actual SDK calls and cancels pending transport work without stale results', async () => {
    const worker = await runtime.getWorker('relay-knowledge-a');
    for (const cancel of [false, true]) {
      const parent = new AbortController();
      let delay = false;
      let transportAborted = false;
      const connection = await connectKnowledge({
        secret,
        candidateId: 'fictional-alex',
        environment: 'local',
        contentVersion: version,
        traceId: crypto.randomUUID(),
        signal: parent.signal,
        timeoutMs: 600,
        binding: {
          fetch: async (request) => {
            if (delay && request.method === 'POST')
              await new Promise<never>((_, reject) =>
                request.signal.addEventListener(
                  'abort',
                  () => {
                    transportAborted = true;
                    reject(request.signal.reason);
                  },
                  { once: true },
                ),
              );
            return localFetch(worker, request);
          },
        },
      });
      delay = true;
      const pending = connection.call('get_candidate_profile', {
        version,
        sections: ['background'],
      });
      if (cancel) setTimeout(() => parent.abort(), 30);
      await expect(pending).rejects.toThrow();
      await connection.close();
      expect(transportAborted).toBe(true);
    }
  });
});
