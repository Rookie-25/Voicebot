import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = 'apps/web/dist';
const banned = [
  /sk-[a-zA-Z0-9_-]{20,}/,
  /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/,
  /CLOUDFLARE_API_TOKEN\s*[:=]/,
  /MCP_SERVICE_SECRET|UNPUBLISHED_FIXTURE_SECRET|DRAFT_FIXTURE_SECRET|SYNTHETIC FIXTURE/,
];
let jsGzip = 0;
async function inspect(path) {
  for (const name of await readdir(path)) {
    const file = join(path, name);
    if ((await stat(file)).isDirectory()) {
      await inspect(file);
      continue;
    }
    if (!/\.(js|css|html|json|map)$/.test(name)) continue;
    const buffer = await readFile(file);
    if (banned.some((pattern) => pattern.test(buffer.toString())))
      throw new Error(`Potential credential in ${file}`);
    if (name.endsWith('.map')) throw new Error('Public source maps must be explicitly reviewed.');
    if (name.endsWith('.js')) jsGzip += gzipSync(buffer).length;
  }
}
await inspect(root);
console.log(`Frontend JS: ${(jsGzip / 1024).toFixed(1)} KiB gzip; credential-pattern scan passed.`);
if (jsGzip > 180 * 1024) throw new Error('Frontend JS exceeds the 180 KiB gzip M1 budget.');
