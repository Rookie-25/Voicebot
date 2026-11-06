import { FailureOutput, ServiceClaims, type FailureCode } from './index';

export class McpFailure extends Error {
  constructor(readonly code: FailureCode) {
    super(code);
    this.name = 'McpFailure';
  }
}
const encoder = new TextEncoder();
function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}
function decode(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new McpFailure('UNAUTHORIZED');
  return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), (char) =>
    char.charCodeAt(0),
  );
}
const keys = new Map<string, Promise<CryptoKey>>();
async function key(secret: string) {
  if (secret.length < 32) throw new McpFailure('UNAVAILABLE');
  const existing = keys.get(secret);
  if (existing) return existing;
  if (keys.size >= 4) keys.delete(keys.keys().next().value!);
  const imported = crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
  keys.set(secret, imported);
  try {
    return await imported;
  } catch (error) {
    keys.delete(secret);
    throw error;
  }
}
export async function signServiceToken(claims: ServiceClaims, secret: string): Promise<string> {
  const checked = ServiceClaims.parse(claims);
  const body =
    encode(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))) +
    '.' +
    encode(encoder.encode(JSON.stringify(checked)));
  return (
    body +
    '.' +
    encode(
      new Uint8Array(await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(body))),
    )
  );
}
export async function verifyServiceToken(token: string, secret: string): Promise<ServiceClaims> {
  try {
    if (token.length > 4096) throw new Error();
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error();
    const [header, payload, signature] = parts as [string, string, string];
    const parsedHeader: unknown = JSON.parse(new TextDecoder().decode(decode(header)));
    if (JSON.stringify(parsedHeader) !== JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
      throw new Error();
    if (
      !(await crypto.subtle.verify(
        'HMAC',
        await key(secret),
        decode(signature),
        encoder.encode(`${header}.${payload}`),
      ))
    )
      throw new Error();
    const claims = ServiceClaims.parse(JSON.parse(new TextDecoder().decode(decode(payload))));
    const now = Math.floor(Date.now() / 1000);
    if (
      claims.exp <= now ||
      claims.iat > now + 5 ||
      claims.exp <= claims.iat ||
      claims.exp - claims.iat > 60
    )
      throw new Error();
    return claims;
  } catch {
    throw new McpFailure('UNAUTHORIZED');
  }
}
export function failureOutput(error: unknown, traceId: string) {
  const code = error instanceof McpFailure ? error.code : 'UNAVAILABLE';
  return FailureOutput.parse({
    status: 'error',
    traceId,
    code,
    retryable: code === 'TIMEOUT' || code === 'UNAVAILABLE',
  });
}

// Races both deadlines and caller cancellation; does not claim to cancel a D1
// query already accepted by the database. Its late read result is discarded.
export async function bounded<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  ms: number,
  parent?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort(new McpFailure('CANCELLED'));
  if (parent?.aborted) throw new McpFailure('CANCELLED');
  parent?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => controller.abort(new McpFailure('TIMEOUT')), ms);
  let rejectAbort: (() => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(controller.signal.reason);
    controller.signal.addEventListener('abort', rejectAbort, { once: true });
  });
  try {
    return await Promise.race([
      Promise.resolve().then(() => operation(controller.signal)),
      aborted,
    ]);
  } finally {
    clearTimeout(timer);
    parent?.removeEventListener('abort', cancel);
    if (rejectAbort) controller.signal.removeEventListener('abort', rejectAbort);
  }
}
export async function readBoundedBody(
  request: Request,
  limit: number,
  signal: AbortSignal = request.signal,
): Promise<string> {
  if (Number(request.headers.get('content-length')) > limit) throw new McpFailure('TOO_LARGE');
  const reader = request.body?.getReader();
  if (!reader) throw new McpFailure('INVALID_INPUT');
  const cancel = () => {
    void reader.cancel(signal.reason).catch(() => undefined);
  };
  signal.addEventListener('abort', cancel, { once: true });
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      signal.throwIfAborted();
      const { value, done } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      size += value.length;
      if (size > limit) throw new McpFailure('TOO_LARGE');
      chunks.push(value);
    }
    const all = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      all.set(chunk, offset);
      offset += chunk.length;
    }
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(all);
  } finally {
    signal.removeEventListener('abort', cancel);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
