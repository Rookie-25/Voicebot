# M2B-B deployment verification

## Current result — 2026-11-07 (India time)

**PARTIAL overall: deployed protocol/security/cleanup PASS; sustained Free-plan
CPU fit remains unproven and measured samples exceed its nominal 10 ms budget.**
No upgrade, paid add-on, inference call, production deployment or M3/M4 work occurred.

Public preview: https://voice-bot-gateway-preview.sagnikroy4002.workers.dev

The public interface is still the M1 scripted demo. Genuine MCP was exercised
through the temporary operator-only probe, which has now been removed. There is
no public AI conversation, STT or TTS endpoint yet.

### Deployed inventory and versions

| Resource                    | Identity / verified state                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------- |
| Account                     | `ae373f194c0f1652c1d90a1d43d209e2`, existing owner OAuth login; owner-confirmed Workers Free |
| Public gateway              | `voice-bot-gateway-preview`; workers.dev enabled, version-preview URLs disabled              |
| Private knowledge           | `voice-bot-knowledge-preview`; workers.dev and version-preview URLs disabled                 |
| D1                          | `voice-bot-knowledge-preview`, UUID `a59e9f96-8e5a-470c-93b8-3d5de6cf4884`, binding `DB`     |
| Private HTTP binding        | Gateway `KNOWLEDGE_MCP` -> `voice-bot-knowledge-preview`                                     |
| Final gateway version       | `98e621f2-c034-4b79-b1f4-8e2c0cdbf6f3`, after operator secret deletion                       |
| Final knowledge version     | `b846c90e-181c-4d65-932b-30a6bdb73df6`, after service secret creation                        |
| Probe-enabled proof version | `27b11777-e460-4c7c-9b1d-81216d7ab3c6`; historical only, never roll back to it               |
| Probe-free upload           | `55b911e6-455a-4510-9c45-1e3fc94ba5d0`; final secret-change version above is preferred       |

Workers inventory was independently empty before deployment. Only the two named
Workers were created. Existing D1 was retained. Cloudflare API inspection after
cleanup confirms no account custom Worker domains, no zone Worker routes, no
active log tails, correct DB/service bindings and no `M2B_*` gateway bindings.
The public knowledge hostname returns 404; configuration/API checks, not that
response alone, establish its private exposure boundary.

### D1 verification — no migration/seed replay

Read-only remote SQL verified `0001_approved_knowledge.sql` in the migration ledger,
ten application tables and both public views. The seed was already present, so
neither migration nor seeding was repeated. Data is `fictional-alex / fixture-v1`,
published and synthetic. Counts: one candidate/version/fact/project/story/evidence,
two answers, four variants, two answer-evidence links and one follow-up link.
Both answers are public/approved; all four short/standard variants are approved;
all fact/project/story/evidence/answer approval/visibility violation counts are
zero. `PRAGMA foreign_key_check` returned no rows. Database size was 114,688 bytes.

The first read-only inspection query exceeded D1's compound-SELECT term limit;
it was replaced with scalar count subqueries and succeeded. It made no data change.
The unused top-level `voice_bot_knowledge_preview` binding was removed; Wrangler
preview commands no longer emitted the inheritance warning. Preview `DB` retains
the actual UUID. Owner local/production UUID/formatting edits are preserved in the
working tree and excluded from the milestone commit; see Git review below.

### Real-cloud MCP matrix

The existing official client/server SDKs remain 2.4.0, with Cloudflare agents 0.33.0
HTTP adapter and protocol `2025-11-25`. No REST/function-import substitute was used.
Positive cases verified `initialize`, `notifications/initialized`, `tools/list`,
`tools/call`, tools capability and exactly these tools:
`get_candidate_profile`, `search_interview_knowledge`, `retrieve_approved_answer`.

| Case                                      | Result                                                              |
| ----------------------------------------- | ------------------------------------------------------------------- |
| Profile and search                        | PASS; remote approved synthetic content validated internally        |
| Answer short and standard                 | PASS; IDs, evidence, SHA-256 and follow-up links checked internally |
| Follow-up retrieval                       | PASS                                                                |
| Missing/invalid service authentication    | PASS; expected `UNAUTHORIZED` rejection                             |
| Wrong candidate/environment               | PASS; expected `FORBIDDEN` rejection                                |
| Wrong capability/tool content version     | PASS; expected `VERSION_MISMATCH` rejection                         |
| Insufficient tool scope                   | PASS; expected `FORBIDDEN` rejection                                |
| Missing answer                            | PASS; expected `UNAVAILABLE_CONTENT` rejection                      |
| Invalid tool input                        | PASS at existing client Zod gate after discovery; no tool call sent |
| Two simultaneous positive requests        | PASS; separate trace IDs and valid isolated results                 |
| Missing/invalid operator token            | PASS; HTTP 401                                                      |
| Browser Origin                            | PASS; HTTP 403, no CORS                                             |
| Wrong method / extra input / >2 KiB input | PASS; HTTP 405 / 400 / 413                                          |

There were 14 allowlisted cases, two additional concurrent requests and six
operator-boundary checks: 22 bounded probe requests, not a load test. An operator
HTTP 200 means its selected assertion passed, including expected MCP denials; it
does not mean unauthorized service access succeeded. Invalid-input server protocol
coverage and actual draft/private/unapproved rows remain local M2A tests. No such
canaries were uploaded simply to test them in preview. No cloud cancellation or
long-running load/reliability claim is made.

### Sanitized logs, latency and CPU

Two temporary API/WebSocket live tails projected metadata before storage; raw
request headers, WebSocket credentials, approved content and exception stacks were
not retained. Captured 33 invocation records: all `ok`, zero exceptions. Example
trace `4c25681b-9f15-4232-8faf-353cd08c9815` appears in both Workers; profile,
search and answer traces can be joined across client/server events. Capture is
not exhaustive: some response trace IDs lack both live-tail records. All positive
probe responses passed their own transport/output trace checks.

Sequential positive client-observed elapsed times: profile 2,374 ms, search 289 ms,
short answer 567 ms, standard 309 ms, follow-up 233 ms. Median 309 ms; this includes
operator network/TLS, handshake and D1, and is not speech latency or a benchmark.

Live-tail `cpuTime` samples: knowledge 1–35 ms (17 invocations, mean 12.76 ms),
gateway 0–74 ms (16 invocations, mean 16.75 ms). Eight knowledge and seven gateway
samples exceeded 10 ms. No observed invocation returned error 1102 or `exceededCpu`.
Account GraphQL returned 74 requests, zero errors and CPU quantiles 4,662 / 74,847
for p50/p99, but labeled the script `__unknown__`; it is not reliable per-Worker
attribution. Raw provider metrics are retained locally without claiming more scope.

Cloudflare documents some isolate flexibility for occasional CPU overruns; passing
this small Free-account proof does not establish sustained capacity below its
10 ms request budget. **Optimize/profile and remeasure before treating Free as a
reliable public traffic capacity commitment.** No paid upgrade was attempted.
Sources: [Workers CPU limits](https://developers.cloudflare.com/workers/platform/limits/),
[Workers metrics](https://developers.cloudflare.com/analytics/graphql-api/tutorials/querying-workers-metrics/).

### Diagnostic cleanup and post-deployment checks

- Removed the temporary probe module, gateway import/dispatch, preview asset routing
  exception, `M2B_*` vars, operator placeholder and temporary probe test suites.
  Preserved fixture validation as `tests/preview-fixture.test.ts`; retained the real
  SDK client/server, read-only tools, private binding and local-only private RPC.
- Redeployed probe-free gateway, then deleted `M2B_OPERATOR_TOKEN` via preview-scoped
  Wrangler. Secret listing and live settings show only `MCP_SERVICE_SECRET` on each
  Worker. The matching service keys remain configured and never enter source.
- Fresh random secrets were sent through Wrangler's supported bulk-stdin workflow
  with log sanitization explicitly enabled. Local service-key backup is Windows
  DPAPI-encrypted under ignored `.local/state/m2b-secrets`; no plaintext key file
  was created. The temporary operator backup is removed after verification.
- Frontend and `/healthz`: HTTP 200. Retired probe POST, including the old token:
  HTTP 405 from Cloudflare's asset router; no diagnostic runs. GET on that unknown
  path returns only the SPA HTML (200), not MCP JSON. `/mcp` POST likewise returns 405. `/api/v1/turn` still returns the intended skeleton 501.
- Knowledge public hostname returns 404; API confirms workers.dev/version URLs
  disabled, no custom domains/routes and no active tails. No Worker/DB was deleted.

### Local validation and environment

After recovery, strict verification passed all 14 checks at C: 5.26 GiB / D: 75.40
GiB. C: remained above 5 GiB during the successful deployment/testing steps. Focused
cleanup tests: **10/10 passed** across Worker health/retired route, preview fixture
and service security. TypeScript and ESLint passed. Existing frontend artifact scan
passed at 92.9 KiB JavaScript gzip. No browser or full-suite rerun, installation,
system cleanup or pagefile modification occurred. Historical 60-test preparation
results are not claimed as a fresh M2B-B execution.

Before/after focused tests: C: 5.631 -> 5.630 GiB; D: 75.388 -> 75.388 GiB.
Sanitized evidence is ignored under `.local/artifacts/m2b/`: `inventory.json`,
`d1-approved-state.json`, `probe-results.json`, `sanitized-tail.json`, `metrics.json`,
`exposure.json`, `final-smoke.json` and disk snapshots. No raw authenticated headers
or credentials belong in Git.

### Git and next milestone boundary

Baseline `6a2824b`. Commit only preview binding identity, probe retirement, retained
fixture/regression tests and sanitized documentation. Owner local/production DB
UUID and indentation edits remain unstaged; production has not been deployed.
The committed production/local placeholders must remain separate from preview.
No changes to public UI, dependencies, MCP tool implementation or provider APIs.

Before M3: decide and validate the Free CPU mitigation; keep production/local DB
separation reviewed. M3 requires separate approval for approved-text orchestration
and public endpoint protection; M4 separately adds synthetic voice. No additional
infrastructure is introduced for this handoff.

## Previous blocked attempt (historical)

2026-11-07: **BLOCKED at environment preflight.** Deployment is authorized, but
the strict environment gate failed with C: 1.09 GiB free (below the 2 GiB stop
threshold); D: has 75.40 GiB free. No Wrangler/account commands, builds, tests,
uploads, migrations, seeding or deployments were started in this attempt.

Git baseline is `6a2824b` on `main`, tracking `origin/main`. The knowledge Wrangler
configuration already had owner edits, including the actual preview D1 UUID.
Those edits are preserved. Source inspection confirms the unused top-level
`voice_bot_knowledge_preview` binding duplicates the intended preview database;
only that redundant binding was removed. The actual preview `DB` binding remains
`a59e9f96-8e5a-470c-93b8-3d5de6cf4884`. No other environment was edited by this attempt.
Wrangler validation of the warning repair remains pending safe headroom.

Important existing configuration issue: the owner's working copy also assigns the
preview database UUID to the local and production DB bindings. These values were
not changed because unrelated/production edits are outside this preview repair.
Do not deploy production or enable remote local development with this configuration;
review environment separation before any such operation.

The owner reports preview D1 creation and migration success. These have not been
independently rechecked remotely during this attempt. Seed status, Worker inventory,
gateway URL, deployed MCP protocol/tools, remote exposure, logs and CPU remain
unverified. Do not recreate the DB or blindly rerun migration when resuming.
The local gateway probe remains disabled in configuration. No probe was activated
or removed from a live Worker in this attempt. No commit or push was made.

Recovery: owner closes unneeded memory-heavy applications and, if helpful, restarts
Windows; no forced termination, cleanup or pagefile change is authorized here.
Recover at least 2 GiB free, preferably 5 GiB for deployment builds, then reload
`scripts/dev-env.ps1` and rerun `scripts/verify-env.ps1 -Strict`. Existing M2B-B
authorization persists. Resume with identity/inventory verification, configuration
validation and read-only remote schema/row inspection before deciding whether to seed.
