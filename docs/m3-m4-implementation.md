# Accelerated M3/M4 implementation — local verification passed

2026-11-07 closure: **48/48 focused Vitest tests passed across eight files**, serially,
against freshly compiled Workers. TypeScript, lint, selected-source formatting,
frontend build, both Worker dry-run builds and frontend credential scan passed.
Eight additional lightweight contract/state/preview-fixture tests passed separately:
**56 Vitest tests passed in total**, without repeating a parallel full suite.
Two focused Edge browser journeys passed: real local text/MCP/D1 with signed
follow-up, and separately emulated speech controls. Initial ambiguous UI and
answer-length test locators were corrected; no product workaround was needed.

The isolated setup script ran successfully (no pending migrations, approved fixture
present). Running Vite -> gateway -> private MCP -> local D1 returned exact approved
`intro` and standard `followup` text. Logs show initialization, initialized notification,
discovery and invocation under correlated request IDs. The test provider is explicitly
local and a runtime test confirms preview ignores its flag. This is not a real LLM test.

Strict verification passed 14/14. Entry C:/D: were 5.27/75.38 GiB. C: dipped to
3.90 GiB before browser work, then recovered to 5.43 GiB. Final serial tests started
at 5.417 and ended at 5.416 GiB C:. Pagefile was 5,641 MiB allocated, 678 MiB in use;
available physical memory about 1.84 GiB before final checks. No system settings,
cleanup, dependency installation or cloud configuration changed.

Read-only preview secret-name inspection found only `MCP_SERVICE_SECRET`.
Owner confirmed the OpenAI key has not yet been entered and requested local
verification first. Live activation remains blocked at that credential boundary;
no preview namespace has been provisioned or real model request made. The SQLite
quota actor was exercised locally, including atomic admission, concurrency,
per-IP/session/global limits and release. Public deployment and real microphone /
audible playback remain unverified. Local screenshots are under
`.local/artifacts/playwright/local-interview.png` and `voice-flow-390.png`.

Public preview remains the previously deployed M2B scripted demo at
https://voice-bot-gateway-preview.sagnikroy4002.workers.dev — none of the new UI/API
or speech changes is public yet. Live AI, real speech-device behavior, fresh public
browser smoke and submission readiness are unverified. No deployment is permitted
until the owner securely enters the key and remaining live gates pass.

## Implemented source

- `apps/gateway/src/turn.ts`: real `/api/v1/turn` pipeline using the existing official
  SDK client and private HTTP binding; bounded approved answer discovery, selection
  and fresh variant retrieval. No direct D1 read bypass or public MCP endpoint.
- `model.ts`: one real OpenAI Chat Completions adapter via native fetch; strict
  JSON-schema answer-ID/null selection, `store:false`, reasoning disabled, 512-token
  output cap, 14,000-byte serialized provider-request bound, 12-second timeout,
  no retries and validated output. No SDK/agent-framework dependency added.
- Final speech/display text is exact owner-approved D1 text, never generated model
  prose. Returned ID must belong to the current retrieved allowlist; MCP enforces
  candidate/version/publication/approval/evidence again before output. Unsupported
  questions get a fixed first-person fallback with `grounded:false`.
- Signed HttpOnly/SameSite session and opaque signed follow-up context, one-hour
  expiry, candidate/version/session binding, previous approved text and permitted
  follow-ups only. No arbitrary visitor-provided chat history or invented memories.
- `budget.ts`: prepared SQLite Durable Object, two active 45-second leases, global
  daily admission budget, eight turns/session and five turns/IP-hash/ten minutes.
  Reservations are atomic and never refunded on ambiguous failures; release only
  frees a concurrency slot. No raw IP/question/audio is stored in this ledger.
- `session.ts`: cached HMAC keys, signed context/cookies and pseudonymous quota
  identifiers. Quota state retains the last active UTC day's hashes/counters until
  a later day's access resets the ledger; no stronger automatic deletion is claimed.
- Strict Origin/JSON/body/schema checks, 2,000-character questions, 12 KiB request
  body, 20-second overall deadline, cancellation, no-store and sanitized errors.
  Provider keys and session/service secrets stay server-side.
- Frontend now uses `/api/v1/config` and `/api/v1/turn`; no old scripted reply
  fallback. Explicit test/fictional/disabled labels, concise/standard lengths,
  clear service errors and bounded in-memory context. Existing dark visual design
  remains, with compact audio preferences rather than a dashboard.
- Browser-native dictation, interim transcript in the composer, explicit speech
  processing consent, permission/error fallback, manual stop and 20-second limit.
  Users review and submit recognized text. Browser synthesis supports available
  voice selection, playback cancellation, replay and a 45-second watchdog.
  Epoch checks suppress stale recognition/playback callbacks and overlapping audio.
- Microphone Permissions-Policy changes to `microphone=(self)`; no voice cloning.
  Browser recognition may send audio to its vendor's service and is not universally
  supported. Synthetic voice quality depends on the installed/browser voices.

## MCP CPU work and limits

Code inspection found repeated HMAC import and request clone/JSON parsing in every
transport call. Added a bounded four-key cache (keys only, never claims/answers) and
direct parsing of SDK string bodies for trace method extraction. Every connection
still performs real initialization, negotiation, discovery and tool invocation.
No cross-session client/transport reuse, bypass or authentication cache was added.
Failure traces are now validated as well as success traces. Turn clients receive
only knowledge-search and answer-read capabilities.

Search now explicitly allows an empty query to browse at most five published public
matches. This is a bounded catalogue fallback for a small initial answer library,
not private/unapproved retrieval. Keywords select a relevant subset first. A larger
library needs retrieval evaluation; no vector database or model planning chain was
introduced. Approvals and published-version checks remain fresh on each tool call.

**No new cloud CPU measurements exist.** The M2B 35/74 ms samples remain the known
risk; static optimization is not proof of fitting Free's nominal 10 ms budget.

## Provider choice and spending boundary

Current official model pages marked GPT-4o mini, GPT-4.1 mini, GPT-5 mini and GPT-5.4
nano deprecated. The prepared current integration uses **GPT-5.6 Terra**, reasoning
`none`, with supported Chat Completions/structured outputs. Published standard
prices checked: **$2/M input, $12/M output tokens**; not free inference.
Model availability/project access and actual model behavior still need a live test.
Changing the model requires reviewing the adapter's price guard and reservation.

The proposed application cap is $1 per UTC admission day, with a deliberately
conservative $0.05 reservation per attempted turn: at most 20 admitted turns/day.
The serialized request cap and 512-output-token bound make that reservation
conservative at the reviewed model price, including margin for framing/cache writes.
It is an application admission control, not a replacement for provider project
spending controls, pricing review or invoice reconciliation. Failed/unsupported
turns can consume capacity without spending the full reservation.

No OpenAI key was found in the process or local gateway secret names. The owner
explicitly approved capped live setup: **$1/UTC day and one SQLite Durable Object
namespace**. This approval persists; do not ask again. The key is still pending.
This adds no separate Worker. SQLite Durable
Objects are available on Workers Free; hitting Free quotas fails rather than
authorizing a plan upgrade. The local-only configs declare a local test namespace.
Preview configuration is now prepared with `BUDGET`, its SQLite class migration,
reviewed model/cap and `LIVE_AI_ENABLED=false`. Nothing has been provisioned.
Production configuration is untouched. Do not deploy while tests/headroom are blocked.

Public inference fails closed unless live enablement, reviewed model, API key,
session key, quota namespace and valid daily cap are all configured. The test
selector is accepted **only** for explicitly enabled local mode; preview/production
cannot fall back to mock AI. No secrets appear in browser environment variables.

Sources: [current model](https://developers.openai.com/api/docs/models/gpt-5.6-terra/),
[structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs),
[Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create),
[Durable Object Free limits](https://developers.cloudflare.com/durable-objects/platform/pricing/),
[browser recognition limitations](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition).

## Local setup after disk recovery

No new packages or browser binaries are required. `scripts/init-interview-local.mjs`
has already appended a new local session secret to ignored gateway `.dev.vars`,
preserving both existing local MCP keys. Values were not printed. Do not reuse
local credentials in Cloudflare preview.

For the verified local demo, from D:-configured PowerShell:

```powershell
. .\scripts\dev-env.ps1
.\scripts\verify-env.ps1 -Strict
.\scripts\init-interview-local.ps1
```

The setup migrates an **isolated local** database under `.local/state/interview-knowledge`
and seeds the approved fictional fixture only when no candidates exist. It never
uses `--remote` or touches the already deployed D1 database. It was runtime-verified
during closure. Then use separate D:-configured shells:

```powershell
npm.cmd run dev:interview:knowledge
npm.cmd run dev:interview:gateway
npm.cmd run dev
```

Open http://127.0.0.1:5173. Vite proxies `/api` to the local gateway. This local
configuration uses the explicitly labeled deterministic test selector, real MCP,
local D1 and local quota actor. It is not real AI. Both short/standard fictional
variants are available in the isolated approved fixture.

## Candidate onboarding

1. Copy `content/candidate.template.json` into ignored `.local/content/` or another
   owner-private location. Never put personal résumé material in tracked assets.
2. Fill verified facts/projects/stories and source evidence from owner-provided
   material only. Draft first-person short (<=400 chars) and standard (<=900 chars)
   answers, with evidence IDs and optional relevant follow-up answer IDs. No live
   model has drafted personal facts in this work. Blank templates are rejected.
3. Keep review/entry approvals false while drafting. Generate private draft SQL:

   ```powershell
   node scripts/prepare-candidate.mjs .local/content/candidate.json
   ```

4. Owner reviews every first-person claim, dates, metrics and source relationships.
   Mark each included row approved, set review approval, reviewer and ISO timestamp.
   Use a new immutable version ID when revising an already imported version.
5. Explicitly prepare reviewed publication SQL:

   ```powershell
   node scripts/prepare-candidate.mjs .local/content/candidate.json --publish-reviewed
   ```

The compiler validates IDs, lengths, duplicates and evidence/follow-up references,
escapes SQL literals, refuses output overwrites and writes only under `.local/content`.
Without the explicit flag/review metadata all rows are private/unapproved drafts.
It **does not upload anything**. Owner approval of real content and separate review
of the generated SQL are required before remote import. Inspect remote versions
before importing; no DB reset or blind replay. Import/verify new content first,
then coordinate candidate/version pointers on both preview Workers; set fictional
disclosure off only after actual non-synthetic content is verified. Mismatched
versions must fail closed. Production remains out of scope.

## Historical implementation-attempt disk stop (superseded by closure above)

- Strict entry verification: 14/14 passed, C: 5.61 GiB / D: 75.39 GiB.
- Frontend and both Worker builds: passed. Wrangler operations were `--dry-run`,
  not deployments. Frontend artifact scan passed at 94.7 KiB JavaScript gzip.
  Vite emitted its existing chunk-size warning; no performance claim is made.
- Implementation TypeScript and lint: passed after routine fixes. Final added
  content/browser-test fixtures require the next type/format check.
- Focused test command: **not executed**, because its pre-start C: guard failed.
  New model, turn/MCP/quota, content, UI and speech tests are written but unverified.
  Browser fixture tests clearly emulate recognition/playback and model responses;
  even a future pass would not prove real microphone/service/audio-device operation.
- Last blocked drive snapshot: C: **1.970 GiB** (2,115,260,416 bytes), D: **75.388 GiB**.
  Current pagefile allocation/current/peak: 6,624 / 1,557 / 1,593 MiB. Available
  physical memory 2,482,792 KiB; virtual memory 1,704,820 KiB. No initial pagefile
  snapshot exists for this attempt, so the full disk decline is not attributed.
- No system cleanup, Windows/pagefile changes, personal-process termination,
  installation or browser run occurred. No heavy process remains intentionally
  running for this implementation. No remote Cloudflare operation or paid-provider request ran.
- Git baseline `9861949`; changes are uncommitted/unpushed. Owner knowledge config
  edits, including problematic local/production UUIDs, are preserved. New isolated
  local configs avoid those bindings. Never deploy production with the preview DB.

## Resume verification and activation

After owner-managed disk recovery, run formatting on the changed files, typecheck,
lint, build and the focused tests **serially**, sampling C:/D: between phases:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd exec -- vitest run tests/model.test.ts tests/turn-integration.test.ts tests/content-workflow.test.ts tests/workers.test.ts tests/mcp-security.test.ts apps/web/src/App.test.tsx apps/web/src/conversation/speech.test.tsx --maxWorkers=1
# Only after stable headroom >=5 GiB:
npm.cmd run test:browser -- tests/e2e/voice-flow.spec.ts --workers=1
```

Do not claim a test passed until executed; fix failures within this scope. Existing
protocol tests should be selected to verify the HMAC/cache and empty-query changes
without repeating the full historical parallel suite. Browser speech emulation
does not replace an owner-operated microphone and audible playback test.

Spending/resource approval is now granted. Only after tests, headroom and secure credentials:

- Validate the prepared preview-only SQLite `InterviewBudget` binding/migration
  with Wrangler dry run before provisioning.
  Keep production untouched; local/production D1 edits remain for owner review.
- Enter new preview `SESSION_SECRET` and owner project `OPENAI_API_KEY` through
  Wrangler `secret put ... --env preview` prompts; never paste values into chat.
  Keep the existing matching `MCP_SERVICE_SECRET` bindings intact.

  Owner key entry, **after disk recovery**, in their own PowerShell terminal:

  ```powershell
  . .\scripts\dev-env.ps1
  .\scripts\verify-env.ps1 -Strict
  $env:CLOUDFLARE_ACCOUNT_ID = 'ae373f194c0f1652c1d90a1d43d209e2'
  npm.cmd exec --workspace @voice-bot/gateway -- wrangler secret put OPENAI_API_KEY --env preview
  ```

  Enter the key only in Wrangler's secret prompt, not chat, command arguments or
  tracked files. This does not by itself enable paid inference. The agent can
  generate/upload the separate session secret securely after runtime gates pass.

- Set preview `LLM_MODEL=gpt-5.6-terra`, `DAILY_BUDGET_CENTS=100`,
  `CONTENT_MODE=fictional` until real content is approved; enable live inference
  explicitly only when budget/credentials are verified. No public test provider.
- Deploy the updated private knowledge Worker first (the search schema changed),
  then gateway/frontend, both `--env preview`. Do not recreate Workers or D1.
- Perform a bounded actual-model smoke, inspect CPU/errors/quotas, then a fresh
  browser voice-input -> grounded real response -> audible synthetic playback test.
  Stop on billing/security/CPU-limit failures; no paid plan change is authorized.

Assessment readiness remains blocked by credentials, live deployment verification,
real candidate content approval and live voice proof. Spending/resource approval
has been received; do not treat it as permission to skip these gates.
