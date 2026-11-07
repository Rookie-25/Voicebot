# M3/M4 preview activation — provider blocked

2026-11-07. Status: PARTIAL. New frontend/API, private knowledge Worker and SQLite
quota infrastructure are deployed. Real answer generation is blocked by an OpenAI
HTTP 429 response. Inference was disabled after diagnosis; no mock fallback exists.

## Serving resources

- Public URL: https://voice-bot-gateway-preview.sagnikroy4002.workers.dev
- Gateway serving version: `20d1dc4a-8de2-4620-bec5-81c9a4be5a27`, 100% traffic.
- Last successful deployment selection: `78ff210f-8289-4624-a6c6-1f6fbc674f30`.
- Knowledge serving version: `d9c6180a-e490-4614-bbdf-8b8ff419119c`.
- Budget namespace: `575a9275fa874bc296308a7073db28af`, class `InterviewBudget`,
  `use_sqlite: true`, migration `interview-budget-v1` successfully deployed.
- Existing preview D1 and approved `fictional-alex` / `fixture-v1` data reused.
  No migration, seed, database recreation or production deployment occurred.
- OpenAI, session and MCP bindings verified as `secret_text`. A separate random
  session secret was generated/uploaded without printing or persisting its value.
  Existing MCP service secrets were preserved; authenticated cloud MCP succeeded.
- Knowledge workers.dev and preview URLs both verified disabled.

The initial inspection found serving/latest version
`64ec46e8-767b-43a3-8721-381953cbeb18` aligned and the OpenAI binding already a proper
Secret. No plaintext conversion or historical-version restoration was needed.
After fresh source deployments, the documented deployments API selected the known
new M3/M4 disabled version when smoke failed. This version contains the new frontend,
quota binding and required secrets; it is not the retired operator-probe version.

The newest uploaded diagnostic version `fd3e64fc-b61c-45ba-b05b-06f6afdaafb8` is NOT
serving. Do not deploy it blindly: its inference flag is enabled. After resolving
the blockers, create/deploy a fresh version from reviewed source rather than
restoring an arbitrary historical version or blindly running secret updates against
a different latest upload. Never use the removed M2B probe as rollback.

## Smoke evidence

Exactly two turn requests were made; both stopped safely with HTTP 503. No third
model smoke request, retry or load test was made.

1. Trace `03ed8f2d-9414-4525-9760-9b4b70eb7544`: introduction, 2,121 ms end-to-end,
   sanitized `UNAVAILABLE` response.
2. Trace `94686821-ae48-46fd-9093-0eed16ad26c6`: introduction, 2,235 ms end-to-end.
   Correlated live traces verified MCP initialize 200, initialized notification 202,
   tools/list 200 and knowledge tools/call 200. The optional SSE GET returned the
   expected 405 for this stateless transport. Provider returned **HTTP 429**; its
   error code did not match the allowed log vocabulary and was recorded as `other`.
   Billing/project quota versus rate limiting cannot be distinguished from this
   sanitized evidence. No raw provider error body was logged.

Eight sanitized trace events reported `outcome: ok`, zero uncaught exceptions.
The application handled the provider error; a platform `ok` is not a successful AI
answer. Tail CPU samples: gateway turn 32 ms; knowledge initialization 13 ms and
other knowledge invocations 0–7 ms. These exceed Free's nominal 10 ms Worker CPU
budget in some samples; no CPU-limit termination was observed in these requests.
Sustained Free-plan viability is not established. No paid upgrade occurred.

Both requests passed the private quota actor before reaching OpenAI. Each admitted
attempt conservatively reserves $0.05, including failed attempts: the two observed
attempts account for $0.10 in reservations. No direct remote ledger-total read or
cloud cap-exhaustion test is claimed. Configured admission ceiling remains $1 per
UTC day, at most 20 reserved attempts, two active leases, eight/session and
five/IP-hash/ten minutes. This is not a provider billing hard limit.

Public frontend HTTP 200 and `/api/v1/config` verified after disabling:
`available:false`, `provider:disabled`, `fictional:true`. Live approved answer,
fallback, follow-up, browser response rendering and physical microphone/playback
are NOT verified. The new frontend is deployed; it no longer supplies scripted AI.

## Checks and operational boundaries

The only code change in this activation adds bounded, sanitized provider status /
allowlisted-code logging. Its 13 model/session tests and gateway dry-run build
passed; formatting was applied. The previously passing 56-test and browser suites
were not repeated. No dependency installation or frontend rebuild was needed.

Entry strict environment verification passed 14/14, C: 2.27 GiB, D: 75.26 GiB.
Local development processes started by this agent were stopped. Later C: fell below
2 GiB, eventually 0.897 GiB; heavy local work stopped. No system cleanup/pagefile
change or unrelated process termination was performed. A final metadata recheck
returned Cloudflare OAuth HTTP 401; the last successful serving-version selection
above and subsequent public fail-closed HTTP check are the available evidence.

Sanitized artifacts remain ignored under `.local/artifacts/m3m4/`. No credentials,
cookies, signed context, raw headers or personal candidate content were committed.
Owner edits to `apps/knowledge-mcp/wrangler.jsonc` remain untouched and excluded.
Its local/production references to the preview UUID still require separate review;
production must not be deployed with those references.

## Resume

1. Owner checks the OpenAI API project's billing/credits, usage caps and rate limits
   for the key. Do not send the key in chat. HTTP 429 has not established usable
   model access; another call is not justified until the account constraint is fixed.
2. Recover C: headroom (at least 2 GiB, preferably 5 GiB). No automatic cleanup is
   authorized. Let Wrangler refresh its existing OAuth session; if that fails,
   owner reauthentication is required before further cloud changes.
3. Re-inspect serving/latest versions and encrypted bindings. Deploy fresh reviewed
   source to preview with the same namespace/cap and preserved MCP secrets; do not
   recreate resources. Do not restore a probe or diagnostic enabled version blindly.
4. After owner confirms provider readiness, run one bounded remaining smoke call,
   then agree on any additional verification needed for fallback/follow-ups. This
   attempt's maximum of three must not be silently exceeded.
5. Verify a fresh-browser genuine response and owner-operated microphone/playback.
   Import actual candidate content only through explicit review/publication. Keep
   fictional disclosure until that separate approval and verification is complete.

Official references:
[model and pricing](https://developers.openai.com/api/docs/models/gpt-5.6-terra/),
[version/deployment semantics](https://developers.cloudflare.com/workers/versions-and-deployments/),
[secret workflow](https://developers.cloudflare.com/workers/configuration/secrets/),
[SQLite Durable Objects Free plan](https://developers.cloudflare.com/durable-objects/platform/pricing/).
