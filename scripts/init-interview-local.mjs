import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
const gateway = 'apps/gateway/.dev.vars',
  knowledge = 'apps/knowledge-mcp/.dev.vars';
if (!existsSync(gateway) || !existsSync(knowledge))
  throw Error('Run npm run mcp:local:init first; existing keys are never overwritten.');
const gatewayText = readFileSync(gateway, 'utf8'),
  knowledgeText = readFileSync(knowledge, 'utf8');
const extract = (text) => text.match(/^MCP_SERVICE_SECRET=(.+)$/m)?.[1]?.trim();
if (!extract(gatewayText) || extract(gatewayText) !== extract(knowledgeText))
  throw Error('Local MCP key configuration must match. Values were not printed.');
if (!/^SESSION_SECRET=/m.test(gatewayText))
  appendFileSync(gateway, '\nSESSION_SECRET=' + randomBytes(32).toString('hex') + '\n');
console.log(
  'Local session key ready in ignored .dev.vars; existing MCP credentials preserved. No cloud changes.',
);
