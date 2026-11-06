import {
  ApiErrorSchema,
  AppConfigSchema,
  TurnResponseSchema,
  type TurnInput,
} from '@voice-bot/contracts';

export async function loadConfig(signal: AbortSignal) {
  const response = await fetch('/api/v1/config', { signal, credentials: 'same-origin' });
  if (!response.ok) throw new Error('Configuration unavailable');
  return AppConfigSchema.parse(await response.json());
}
export async function requestTurn(input: TurnInput, signal: AbortSignal) {
  const response = await fetch('/api/v1/turn', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const result = ApiErrorSchema.safeParse(payload);
    throw new Error(
      result.success ? result.data.error.message : 'Answers are temporarily unavailable.',
    );
  }
  return TurnResponseSchema.parse(payload);
}
