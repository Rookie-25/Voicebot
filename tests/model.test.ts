import { describe, expect, it, vi } from 'vitest';
import { openAiSelector } from '../apps/gateway/src/model';
import { sign, verify } from '../apps/gateway/src/session';

const input = {
  question: 'Tell me about yourself.',
  options: [{ id: 'intro', title: 'Introduction', summary: 'An approved introduction' }],
  previous: '',
  followUps: [],
};
function response(content: unknown, finish = 'stop') {
  return Response.json({
    choices: [
      { finish_reason: finish, message: { content: JSON.stringify(content), refusal: null } },
    ],
  });
}
describe('bounded OpenAI adapter, no paid calls', () => {
  it('uses strict ID selection, reviewed model, no storage and a token ceiling', async () => {
    const http = vi.fn<typeof fetch>().mockResolvedValue(response({ answerId: 'intro' }));
    expect(
      await openAiSelector('test-key', 'gpt-5.6-terra', http).select(
        input,
        new AbortController().signal,
      ),
    ).toBe('intro');
    const body = JSON.parse(http.mock.calls[0]![1]!.body as string);
    expect(body).toMatchObject({
      store: false,
      reasoning_effort: 'none',
      max_completion_tokens: 512,
    });
    expect(body.response_format.json_schema.schema.additionalProperties).toBe(false);
    expect(body.response_format.json_schema.schema.properties.answerId.anyOf[0].enum).toEqual([
      'intro',
    ]);
  });
  it.each([
    { answerId: 'invented' },
    { answerId: 'intro', text: 'Invented achievement' },
    'bad-format',
  ])('rejects unapproved output %j', async (content) => {
    const http = vi.fn<typeof fetch>().mockResolvedValue(response(content));
    await expect(
      openAiSelector('test-key', undefined, http).select(input, new AbortController().signal),
    ).rejects.toThrow();
  });
  it('does not speak truncated output or provider errors', async () => {
    const http = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({ answerId: 'intro' }, 'length'))
      .mockResolvedValueOnce(new Response('secret-provider-error', { status: 500 }));
    const adapter = openAiSelector('test-key', undefined, http);
    expect(await adapter.select(input, new AbortController().signal)).toBeNull();
    await expect(adapter.select(input, new AbortController().signal)).rejects.toThrow(
      'Model service unavailable',
    );
    expect(http).toHaveBeenCalledTimes(2);
  });
  it('refuses a changed model price or oversized prompt before network access', async () => {
    expect(() => openAiSelector('test-key', 'unreviewed-expensive-model')).toThrow();
    const http = vi.fn<typeof fetch>();
    await expect(
      openAiSelector('test-key', undefined, http).select(
        { ...input, question: 'x'.repeat(15000) },
        new AbortController().signal,
      ),
    ).rejects.toThrow();
    expect(http).not.toHaveBeenCalled();
  });
  it.each([401, 403, 404, 429, 503])(
    'sanitizes provider access/rate failures (%i)',
    async (status) => {
      const http = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('private provider detail', { status }));
      await expect(
        openAiSelector('test-key', undefined, http).select(input, new AbortController().signal),
      ).rejects.toThrow('Model service unavailable');
      expect(http).toHaveBeenCalledTimes(1);
    },
  );
  it('bounds a hanging provider call and propagates cancellation', async () => {
    vi.useFakeTimers();
    try {
      const http = vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => {}));
      const pending = openAiSelector('test-key', undefined, http).select(
        input,
        new AbortController().signal,
      );
      const timedOut = expect(pending).rejects.toMatchObject({ code: 'TIMEOUT' });
      await vi.advanceTimersByTimeAsync(12_000);
      await timedOut;
      expect(http.mock.calls[0]![1]!.signal!.aborted).toBe(true);
      const controller = new AbortController();
      const cancelled = openAiSelector('test-key', undefined, http).select(
        input,
        controller.signal,
      );
      const rejected = expect(cancelled).rejects.toMatchObject({ code: 'CANCELLED' });
      controller.abort();
      await rejected;
    } finally {
      vi.useRealTimers();
    }
  });
});
it('authenticates opaque conversation context and rejects tampering', async () => {
  const secret = 'synthetic-session-test-key-never-deploy-123';
  const value = { sid: crypto.randomUUID(), answerId: 'intro' };
  const signed = await sign(value, secret);
  expect(await verify(signed, secret)).toEqual(value);
  await expect(verify(signed + 'x', secret)).rejects.toThrow();
  await expect(verify(signed, secret + 'wrong')).rejects.toThrow();
});
