import { DurableObject } from 'cloudflare:workers';
import { z } from 'zod';

export const ReserveSchema = z.strictObject({
  operation: z.literal('reserve'),
  id: z.uuid(),
  session: z.uuid(),
  ip: z.string().regex(/^[a-f0-9]{64}$/),
});
const ReleaseSchema = z.strictObject({ operation: z.literal('release'), id: z.uuid() });
interface Ledger {
  day: string;
  reserved: number;
  leases: { id: string; until: number }[];
  sessions: Record<string, number>;
  ips: Record<string, { at: number; n: number }>;
}
export class InterviewBudget extends DurableObject<{ DAILY_BUDGET_CENTS?: string }> {
  async fetch(request: Request): Promise<Response> {
    let input: z.infer<typeof ReserveSchema> | z.infer<typeof ReleaseSchema>;
    try {
      input = z.union([ReserveSchema, ReleaseSchema]).parse(await request.json());
    } catch {
      return new Response(null, { status: 400 });
    }
    const cents = Number(this.env.DAILY_BUDGET_CENTS);
    if (!Number.isInteger(cents) || cents < 1 || cents > 100)
      return new Response(null, { status: 503 });
    return this.ctx.storage.transaction(async (txn) => {
      const now = Date.now(),
        day = new Date(now).toISOString().slice(0, 10);
      let state = await txn.get<Ledger>('ledger');
      if (!state || state.day !== day)
        state = {
          day,
          reserved: 0,
          leases: state?.leases.filter((lease) => lease.until > now) ?? [],
          sessions: {},
          ips: {},
        };
      state.leases = state.leases.filter((lease) => lease.until > now);
      if (input.operation === 'release')
        state.leases = state.leases.filter((lease) => lease.id !== input.id);
      else {
        const ip = state.ips[input.ip] ?? { at: now, n: 0 };
        if (now - ip.at > 600_000) {
          ip.at = now;
          ip.n = 0;
        }
        if (
          state.reserved + 50_000 > cents * 10_000 ||
          state.leases.length >= 2 ||
          (state.sessions[input.session] ?? 0) >= 8 ||
          ip.n >= 5 ||
          state.leases.some((l) => l.id === input.id)
        )
          return new Response(null, { status: 429, headers: { 'Retry-After': '60' } });
        // Reserve $0.05 before inference; never refund ambiguous failures/retries.
        state.reserved += 50_000;
        state.sessions[input.session] = (state.sessions[input.session] ?? 0) + 1;
        ip.n++;
        state.ips[input.ip] = ip;
        state.leases.push({ id: input.id, until: now + 45_000 });
      }
      await txn.put('ledger', state);
      return new Response(null, { status: 204 });
    });
  }
}
