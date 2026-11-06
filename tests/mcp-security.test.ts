import { describe, expect, it } from 'vitest';
import { READ_SCOPES, ServiceClaims } from '@voice-bot/mcp-contracts';
import {
  bounded,
  McpFailure,
  signServiceToken,
  verifyServiceToken,
} from '@voice-bot/mcp-contracts/security';

const secret = 'synthetic-unit-test-secret-not-for-deployment-0001';
const claims = () =>
  ServiceClaims.parse({
    iss: 'voice-bot-gateway',
    aud: 'voice-bot-knowledge',
    candidateId: 'fictional-alex',
    environment: 'local',
    contentVersion: 'fixture-v1',
    scopes: [...READ_SCOPES],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60,
    jti: crypto.randomUUID(),
  });
describe('service security primitives', () => {
  it('validates signatures and rejects tampering, expired and overlong credentials', async () => {
    const token = await signServiceToken(claims(), secret);
    expect((await verifyServiceToken(token, secret)).candidateId).toBe('fictional-alex');
    await expect(verifyServiceToken(token, secret + 'wrong')).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    await expect(verifyServiceToken('x'.repeat(5000), secret)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    const expired = await signServiceToken({ ...claims(), iat: 1, exp: 2 }, secret);
    await expect(verifyServiceToken(expired, secret)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    const overlong = await signServiceToken(
      { ...claims(), exp: Math.floor(Date.now() / 1000) + 120 },
      secret,
    );
    await expect(verifyServiceToken(overlong, secret)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
  it('bounds slow operations and forwards caller cancellation', async () => {
    let timedOut = false;
    await expect(
      bounded(
        (signal) =>
          new Promise((_, reject) =>
            signal.addEventListener('abort', () => {
              timedOut = true;
              reject(signal.reason);
            }),
          ),
        20,
      ),
    ).rejects.toMatchObject({ code: 'TIMEOUT' });
    expect(timedOut).toBe(true);
    const parent = new AbortController();
    const pending = bounded(() => new Promise(() => undefined), 2000, parent.signal);
    parent.abort();
    await expect(pending).rejects.toBeInstanceOf(McpFailure);
    await expect(bounded(async () => 'not run', 10, parent.signal)).rejects.toMatchObject({
      code: 'CANCELLED',
    });
  });
});
