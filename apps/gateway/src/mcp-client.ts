import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import {
  MCP_REVISION,
  READ_SCOPES,
  ToolName,
  TraceId,
  ServiceClaims,
  FailureOutput,
  toolInputs,
  toolOutputs,
  type WireEvent,
} from '@voice-bot/mcp-contracts';
import { bounded, McpFailure, signServiceToken } from '@voice-bot/mcp-contracts/security';

export interface PrivateKnowledgeBinding {
  fetch(request: Request): Promise<Response>;
}
export interface McpClientOptions {
  binding: PrivateKnowledgeBinding;
  secret: string;
  candidateId: string;
  environment: 'local' | 'preview' | 'production';
  contentVersion: string;
  traceId: string;
  scopes?: ServiceClaims['scopes'];
  timeoutMs?: number;
  signal?: AbortSignal;
  onTrace?: (event: WireEvent) => void;
}

export async function connectKnowledge(options: McpClientOptions) {
  TraceId.parse(options.traceId);
  const timeout = options.timeoutMs ?? 2000;
  const client = new Client(
    { name: 'voice-bot-gateway', version: '0.2.0' },
    {
      versionNegotiation: { mode: 'legacy' },
      supportedProtocolVersions: [MCP_REVISION],
      capabilities: {},
    },
  );
  const transport = new StreamableHTTPClientTransport(new URL('https://knowledge.internal/mcp'), {
    fetch: async (input, init) => {
      const request = new Request(input, init);
      let method = request.method === 'GET' ? 'stream-open' : 'unknown';
      if (request.method === 'POST') {
        const body: unknown = await request.clone().json();
        if (body && typeof body === 'object' && 'method' in body && typeof body.method === 'string')
          method = body.method;
      }
      const started = Date.now();
      let outcome = 'failed';
      try {
        const result = await bounded(
          async (signal) => {
            const now = Math.floor(Date.now() / 1000);
            const token = await signServiceToken(
              {
                iss: 'voice-bot-gateway',
                aud: 'voice-bot-knowledge',
                candidateId: options.candidateId,
                environment: options.environment,
                contentVersion: options.contentVersion,
                scopes: options.scopes ?? [...READ_SCOPES],
                iat: now,
                exp: now + 60,
                jti: crypto.randomUUID(),
              },
              options.secret,
            );
            const headers = new Headers(request.headers);
            headers.set('Host', 'knowledge.internal');
            headers.set('Authorization', `Bearer ${token}`);
            headers.set('X-Trace-ID', options.traceId);
            const response = await options.binding.fetch(new Request(request, { headers, signal }));
            if (response.headers.get('X-Trace-ID') !== options.traceId)
              throw new McpFailure('PROTOCOL_ERROR');
            outcome = String(response.status);
            return response;
          },
          timeout,
          AbortSignal.any([request.signal, ...(options.signal ? [options.signal] : [])]),
        );
        return result;
      } finally {
        const event: WireEvent = {
          event: 'mcp.client',
          traceId: options.traceId,
          method,
          outcome,
          durationMs: Date.now() - started,
        };
        options.onTrace?.(event);
        console.log(JSON.stringify(event));
      }
    },
  });
  try {
    await bounded(() => client.connect(transport), timeout, options.signal);
    if (
      client.getNegotiatedProtocolVersion() !== MCP_REVISION ||
      !client.getServerCapabilities()?.tools
    )
      throw new McpFailure('PROTOCOL_ERROR');
    const catalog = await bounded(() => client.listTools(), timeout, options.signal);
    if (
      catalog.tools.length !== 3 ||
      new Set(catalog.tools.map((tool) => tool.name)).size !== 3 ||
      catalog.tools.some((tool) => !ToolName.safeParse(tool.name).success)
    )
      throw new McpFailure('PROTOCOL_ERROR');
    return {
      revision: client.getNegotiatedProtocolVersion(),
      capabilities: client.getServerCapabilities(),
      tools: catalog.tools,
      async call(name: ToolName, input: unknown) {
        ToolName.parse(name);
        const args = toolInputs[name].parse(input);
        const result = await bounded(
          (signal) => client.callTool({ name, arguments: args }, { signal, timeout }),
          timeout,
          options.signal,
        );
        if ('isError' in result && result.isError) {
          const failure = FailureOutput.safeParse(result.structuredContent);
          throw new McpFailure(failure.success ? failure.data.code : 'INVALID_INPUT');
        }
        const output = toolOutputs[name].parse(result.structuredContent);
        if (
          output.candidateId !== options.candidateId ||
          output.contentVersion !== options.contentVersion ||
          output.traceId !== options.traceId
        )
          throw new McpFailure('PROTOCOL_ERROR');
        return output;
      },
      close: () => client.close(),
    };
  } catch (error) {
    await client.close().catch(() => undefined);
    throw error;
  }
}
