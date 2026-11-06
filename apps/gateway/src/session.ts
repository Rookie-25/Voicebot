const encoder = new TextEncoder();
const cachedKeys = new Map<string, Promise<CryptoKey>>();
async function key(secret: string) {
  if (secret.length < 32) throw new Error('Session configuration unavailable');
  if (!cachedKeys.has(secret)) {
    if (cachedKeys.size >= 2) cachedKeys.clear();
    cachedKeys.set(
      secret,
      crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify'],
      ),
    );
  }
  return cachedKeys.get(secret)!;
}
function encode(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}
function decode(text: string) {
  return Uint8Array.from(atob(text.replaceAll('-', '+').replaceAll('_', '/')), (c) =>
    c.charCodeAt(0),
  );
}
export async function sign(value: unknown, secret: string): Promise<string> {
  const body = encode(encoder.encode(JSON.stringify(value)));
  return (
    body +
    '.' +
    encode(
      new Uint8Array(await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(body))),
    )
  );
}
export async function verify(token: string, secret: string): Promise<unknown> {
  if (token.length > 3000) throw new Error('Invalid session');
  const [body, sig, ...extra] = token.split('.');
  if (!body || !sig || extra.length || token.length > 3000) throw new Error('Invalid session');
  if (!(await crypto.subtle.verify('HMAC', await key(secret), decode(sig), encoder.encode(body))))
    throw new Error('Invalid session');
  return JSON.parse(new TextDecoder().decode(decode(body)));
}
export async function privateIpHash(ip: string, secret: string) {
  return Array.from(
    new Uint8Array(await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(ip))),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
}
