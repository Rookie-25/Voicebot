import { WorkerEntrypoint } from 'cloudflare:workers';
import { z } from 'zod';
import { ToolName, type WireEvent } from '@voice-bot/mcp-contracts';
import { connectKnowledge, type PrivateKnowledgeBinding } from './mcp-client';

interface DiagnosticEnv {
  APP_ENV: 'local' | 'preview' | 'production';
  LOCAL_MCP_DIAGNOSTICS?: string;
  MCP_SERVICE_SECRET: string;
  CANDIDATE_ID: string;
  CONTENT_VERSION: string;
  KNOWLEDGE_MCP: PrivateKnowledgeBinding;
}
// A private RPC entrypoint, not an HTTP route. Disabled outside local runtime.
export class McpDiagnostics extends WorkerEntrypoint<DiagnosticEnv> {
  async probe(input: unknown) {
    if (this.env.APP_ENV !== 'local' || this.env.LOCAL_MCP_DIAGNOSTICS !== 'true')
      throw new Error('Local diagnostics disabled.');
    const args = z.strictObject({ tool: ToolName, input: z.unknown() }).parse(input);
    const events: WireEvent[] = [];
    const connection = await connectKnowledge({
      binding: this.env.KNOWLEDGE_MCP,
      secret: this.env.MCP_SERVICE_SECRET,
      candidateId: this.env.CANDIDATE_ID,
      environment: this.env.APP_ENV,
      contentVersion: this.env.CONTENT_VERSION,
      traceId: crypto.randomUUID(),
      onTrace: (event) => events.push(event),
    });
    try {
      const result = await connection.call(args.tool, args.input);
      return {
        revision: connection.revision,
        capabilities: connection.capabilities,
        tools: connection.tools.map((tool) => tool.name),
        result,
        events,
      };
    } finally {
      await connection.close();
    }
  }
}
