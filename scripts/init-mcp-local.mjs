import { randomBytes } from 'node:crypto';
import { access, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
if (!root.toLowerCase().startsWith('d:\\') || !process.env.VOICE_BOT_LOCAL) {
  throw new Error('Load scripts/dev-env.ps1 in the D: workspace first.');
}
const files = ['apps/gateway/.dev.vars', 'apps/knowledge-mcp/.dev.vars'].map((path) =>
  resolve(root, path),
);
for (const file of files) {
  try {
    await access(file);
    throw new Error(`Local configuration already exists: ${file}. Nothing overwritten.`);
  } catch (error) {
    if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT')
      throw error;
  }
}
const secret = randomBytes(32).toString('base64url');
for (const file of files)
  await writeFile(
    file,
    `# Local-only service authentication; ignored by Git. Never reuse in cloud.\nMCP_SERVICE_SECRET=${secret}\n`,
    { flag: 'wx' },
  );
console.log(
  'Created matching local-only service keys in ignored .dev.vars files. Values are not displayed.',
);
