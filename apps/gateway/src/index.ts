import { ApiErrorSchema, HealthResponseSchema } from '@voice-bot/contracts';
import { handleM2bProbe, type PreviewProbeEnv } from './m2b-probe';
export { McpDiagnostics } from './mcp-diagnostics';

interface Env extends PreviewProbeEnv {
  ASSETS?: Fetcher;
  KNOWLEDGE_MCP?: Fetcher;
}

const headers = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; media-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
    let response: Response;
    if (path === '/ops/mcp-probe') {
      response = await handleM2bProbe(request, env);
    } else if (path === '/healthz' && (request.method === 'GET' || request.method === 'HEAD')) {
      const health = HealthResponseSchema.parse({
        status: 'ok',
        service: 'gateway',
        version: '0.1.0',
        milestone: 'M1',
        mode: 'skeleton',
      });
      response = Response.json(health);
    } else if (path === '/healthz' || path === '/api' || path.startsWith('/api/')) {
      const methodError = path === '/healthz';
      const error = ApiErrorSchema.parse({
        error: {
          code: methodError
            ? 'METHOD_NOT_ALLOWED'
            : path.startsWith('/api/v1/')
              ? 'NOT_IMPLEMENTED'
              : 'NOT_FOUND',
          message: methodError
            ? 'Use GET or HEAD.'
            : path.startsWith('/api/v1/')
              ? 'This API is not implemented in the M1 interface preview.'
              : 'API route not found.',
          requestId: crypto.randomUUID(),
          retryable: false,
        },
      });
      response = Response.json(error, {
        status: methodError ? 405 : path.startsWith('/api/v1/') ? 501 : 404,
        headers: methodError ? { Allow: 'GET, HEAD' } : {},
      });
    } else if (env.ASSETS && (request.method === 'GET' || request.method === 'HEAD')) {
      response = await env.ASSETS.fetch(request);
    } else {
      response = new Response('Not found', { status: 404 });
    }
    const safe = new Response(request.method === 'HEAD' ? null : response.body, response);
    for (const [key, value] of Object.entries(headers)) safe.headers.set(key, value);
    if (path.startsWith('/api') || path === '/healthz')
      safe.headers.set('Cache-Control', 'no-store');
    return safe;
  },
} satisfies ExportedHandler<Env>;
