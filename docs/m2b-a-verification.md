# M2B-A — local prerequisites and verification

Historical preparation record. The owner subsequently reported the final 60/60
preparation tests passing before `6a2824b`. [M2B-B](m2b-b-verification.md) now records
actual deployed proof, probe retirement and CPU limitations. Temporary probe source
and test files referenced below were removed after that proof; approved fixture
validation remains in `tests/preview-fixture.test.ts`. This is not a claim that
the historical 60 tests were rerun during deployment.

2026-11-06. Local preparation is implemented and the core 55-test verification
passed. An additional retained health regression is deferred for disk/memory
headroom; recover headroom before the final small regression/deployment gate.
**No Cloudflare login, account API call,
resource creation, remote migration, upload, deployment or paid operation occurred.**
No M3/M4 work, provider inference, package installation or browser run was performed.

## Environment and scope

- Loaded `scripts/dev-env.ps1`; initial strict verification passed all 14 checks.
  Portable Node 24.22.2/npm 11.19.1, caches, logs, temporary paths and test artifacts
  remain on D:. No M0 script, machine setting, pagefile setting or personal file changed.
- Initial C: 3.210 GiB (3,446,571,008 bytes); D: 75.384 GiB (80,942,845,952 bytes).
  This passed the existing 2 GiB hard gate but remained below the preferred 5 GiB.
  Only focused serial operations were used; no frontend rebuild or full-suite run.
- Initial pagefile allocation/current/peak: 6,573 / 782 / 1,175 MiB.
  Available physical memory: 2,666,984 KiB (2.54 GiB); available virtual memory:
  2,065,624 KiB (1.97 GiB). CIM observations were read-only.
- Started on `1e23931`, with the prior closure's three modified documentation files
  and untracked M2B runbook already present. Those changes were preserved. No commit,
  push, secret request or authentication was performed.

## Implemented boundary

- Temporary `apps/gateway/src/m2b-probe.ts`, dispatched only at `/ops/mcp-probe`.
  Preview asset configuration routes the exact path through Worker code. Established
  UI files and all production configuration blocks are unchanged.
- Disabled by default. Requires `APP_ENV=preview`, `M2B_PROBE_ENABLED=true`, strict
  UTC `M2B_PROBE_STARTS_AT` / `M2B_PROBE_EXPIRES_AT`, start <= now < expiry and
  a positive window <= 3,600 seconds. No sliding/reset-on-request expiry.
- Requires preview fictional scope and a separate 32-byte random operator token
  represented by exactly 64 lowercase hex characters. Valid fixed-size credentials
  use native `node:crypto` `timingSafeEqual`; Workers `nodejs_compat` already exists.
  Gateway TypeScript now includes the already installed Node declarations; no
  dependency or lockfile change was needed.
- POST-only, browser Origins rejected, no CORS, no-store. JSON is limited to 2 KiB
  measured in bytes, including streamed bodies. Two-second body deadline, ten-second
  whole-operation deadline capped by absolute expiry, and propagated cancellation.
  All operator/config/input gates precede MCP client construction.
- Existing official SDK client/server and service-binding code are unchanged. The
  local-only `McpDiagnostics` RPC guard is unchanged. Preview diagnostics are a
  separate removable module, not a visitor conversation API.
- Responses contain only a fixed case ID, status/outcome, trace UUID, negotiated
  revision/tool names, protocol method names and boolean checks. No tool text,
  hashes, JWTs, keys, database rows, exception messages or stacks are returned.

## Fixed test cases and interpretation

Five positive cases: `profile`, `search`, `answer`, `answer-standard`, `followup`.
They use the existing client to initialize, negotiate revision `2025-11-25`, discover
the three tools and call the selected tool. The probe validates synthetic scope,
known fixture IDs, answer hashes/evidence/follow-up relationships internally.

Nine negative cases: `missing-service-auth`, `invalid-service-auth`, `wrong-candidate`,
`wrong-environment`, `wrong-version`, `wrong-tool-version`, `insufficient-scope`,
`missing-answer`, `invalid-tool-input`. Service-auth failures require the exact
expected HTTP status, sanitized server code and correlated trace. Tool-level failures
require the existing client's typed error. Unexpected dependency failures fail the
probe; they are not treated as successful authorization denials.

`invalid-tool-input` deliberately proves client Zod validation after discovery and
does not send `tools/call`. M2A separately verifies invalid tool inputs over MCP.
Transport-auth failure cases attempt initialization but do not negotiate successfully.
`checks.protocol` means the expected sequence for that particular case. Only positive
cases prove successful initialization, discovery and invocation.

HTTP 200 with `status=passed` means the selected assertion passed, including an
expected denial. An unexpected outcome is HTTP 502 / `status=failed`. Early errors
use sanitized status codes documented in the deployment runbook. Correlated SDK
and server events remain metadata-only; no content logging was introduced.

## Preview SQL

`tests/fixtures/preview-approved.sql` contains only established fictional Alex data:
one candidate, one published synthetic version, one fact, one project, one story,
one evidence item, two approved public answers, four approved variants, two evidence
links and one follow-up link. Standard variants reuse approved short wording.
No private/draft/unapproved canary records or real biography were copied.

Tests apply the existing migration plus this fixture to an isolated local D1
database in Miniflare. `PRAGMA foreign_key_check` is empty; a deliberately broken
evidence relationship is rejected. Published views contain two answers, all
content rows are approved/public, and the actual MCP tools retrieve valid results.
The developer's existing seeded local DB is not modified. SQL cannot enforce a
Cloudflare account/environment by itself: reviewed preview binding/UUID and
explicitly approved `--remote --env preview` commands remain the upload boundary.

## Actual checks

| Check                                      | Result                                       |
| ------------------------------------------ | -------------------------------------------- |
| Strict environment gate                    | 14/14 passed at entry                        |
| Focused probe unit tests                   | 37 passed                                    |
| Focused runtime/config/fixture integration | 18 passed                                    |
| Combined focused run                       | **55 passed across two files, 7.08 seconds** |
| Gateway preview Wrangler dry run           | Passed, 1,273.74 KiB raw / 228.57 KiB gzip   |
| Full workspace TypeScript                  | Passed                                       |
| ESLint                                     | Passed after removing an unused initializer  |
| Existing frontend artifact/credential scan | Passed, 92.9 KiB JavaScript gzip             |

Formatting and Git whitespace checks also passed. The additional five retained
Worker health/config tests were **not** rerun after C: reached 2.156 GiB.

Unit coverage includes disabled/local/production modes, malformed/future/expired/
overlong UTC windows, token absence/shape/mismatch, Origin/method rejection, strict
input/no extra fields, actual UTF-8 byte limits, configuration failure, error
redaction, cancellation during initialization, stalled upload timeout and in-flight
absolute expiry. The expiry test uses a two-second future timestamp to avoid a
near-second-boundary setup race. The combined 55-test run passed with its original
one-second margin; the final test-only increase to two seconds was type/lint/format
checked but not rerun after disk headroom fell. Application code and SQL are unchanged
since the successful 55-test run.

The retained `tests/workers.test.ts` fixtures now declare `nodejs_compat`, matching
both existing Wrangler configurations and the native crypto import. That fixture
alignment was type/lint checked, but its five health/config tests were not rerun.

Runtime tests load the actual gateway bundle and unchanged knowledge bundle under
workerd. The real gateway SDK client crosses the actual HTTP binding directly;
no external SDK relay is needed on this path. Five positive cases assert all four
protocol method names, negotiated version/catalog and content/trace checks. Nine
negative cases, public route restrictions, repeated-request trace isolation, D1
fixture/FK constraints and private/preview configuration also pass.

Commands used, with the D:-based environment and disk gates:

```powershell
npm.cmd exec --workspace @voice-bot/gateway -- wrangler deploy --dry-run --env preview --outdir dist
npm.cmd exec -- vitest run tests/m2b-probe.test.ts tests/m2b-integration.test.ts --maxWorkers=1
npm.cmd run typecheck
npm.cmd run lint
node scripts/check-artifacts.mjs
```

The first unit-test launch was blocked by sandbox subprocess `EPERM`; it was rerun
with authorized local subprocess execution. This was not a failing application test.
The first typecheck identified missing Node ambient declarations for `node:crypto`;
adding existing Node types resolved it. No packages or browser binaries were installed.

## Disk observations and limits

Runtime/build phases sampled C:/D: before and after and refused to start below
2 GiB. Ignored snapshots are `.local/artifacts/m2b-a-*.json`.

| Phase                            | C: before -> after (GiB) | D: before -> after (GiB) |
| -------------------------------- | ------------------------ | ------------------------ |
| First unit run outside sandbox   | 3.178 -> 3.176           | 75.383 -> 75.383         |
| First preview dry-run bundle     | 3.177 -> 3.176           | 75.383 -> 75.383         |
| First runtime integration        | 3.168 -> 3.164           | 75.382 -> 75.382         |
| Workspace typecheck/lint attempt | 3.161 -> 3.162           | 75.381 -> 75.381         |
| Final preview dry-run bundle     | 3.173 -> 3.168           | 75.380 -> 75.380         |
| Combined focused tests           | 3.168 -> 3.167           | 75.380 -> 75.380         |

Whole-drive fluctuations are not per-process attribution. The earlier unexplained
browser-session C: loss was not investigated further; no additional large scan or
cleanup was necessary. Headroom remains fragile: prefer 5 GiB before heavy work,
stop heavy work below 2 GiB, and do not rerun Playwright as part of M2B-A.

After the final successful type/lint/format checks, C: sampled at **2.156 GiB**.
No further runtime/build/test process was started. A later read-only CIM snapshot
(`.local/artifacts/m2b-a-final-resources.json`) recorded:

| Final resource observation           |                             Value |
| ------------------------------------ | --------------------------------: |
| C: available                         |   2,685,816,832 bytes (2.501 GiB) |
| D: available                         | 80,942,100,480 bytes (75.383 GiB) |
| Pagefile allocation / current / peak |         7,604 / 1,326 / 1,788 MiB |
| Available physical memory            |          1,955,940 KiB (1.87 GiB) |
| Available virtual memory             |            792,068 KiB (0.76 GiB) |

Pagefile allocation grew by 1,031 MiB from entry. Drive readings also fluctuated
between samples; this is not proof of complete causation. No system cleanup or
pagefile setting changes were made. The owner can close unneeded memory-heavy
applications and, if appropriate, restart Windows as previously. Do not force-close
applications, delete files or alter pagefile settings. Prefer C: >=5 GiB and improved
memory headroom before another runtime test or deployment build.

## Remaining boundaries and next approval

Working-tree review: **11 modified files, six untracked files**, including prior
M2A-closure documentation carried into this task. No commit or push was made.

- New implementation/data/tests: `apps/gateway/src/m2b-probe.ts`,
  `tests/fixtures/preview-approved.sql`, `tests/m2b-probe.test.ts`,
  `tests/m2b-integration.test.ts`.
- Modified code/config/test fixtures: `apps/gateway/src/index.ts`,
  `apps/gateway/tsconfig.json`, `apps/gateway/.env.example`, both Worker
  `wrangler.jsonc` files, `tests/workers.test.ts`.
- Documentation: new `docs/m2b-a-verification.md` and
  `docs/m2b-deployment-plan.md`; updated `docs/architecture.md`, `docs/security.md`,
  `docs/milestones.md`, `docs/m2a-mcp.md`; retained prior changes to
  `docs/m2a-verification.md`.
- No changes to UI source, package manifests/lockfile, shared MCP implementation,
  M0 scripts, production configuration or machine-wide settings.

- The historical 29-test full suite and four browser regressions were not repeated.
  No UI source changed. New focused tests are additional evidence, not a fresh
  assertion that every historical test ran during M2B-A.
- After recovering headroom, run strict verification and this small serial gate
  before any cloud authentication. It covers the final test-only adjustments and
  retained health/config behavior without a browser or frontend rebuild:

  ```powershell
  . .\scripts\dev-env.ps1
  .\scripts\verify-env.ps1 -Strict
  npm.cmd exec -- vitest run tests/m2b-probe.test.ts tests/workers.test.ts --maxWorkers=1
  ```

- Local workerd does not prove public TLS/static asset dispatch, Cloudflare service
  routing, account permissions, deployed D1 behavior, cold-start time or Free's
  10 ms CPU limit. Preview asset dispatch was configuration-checked and accepted
  by Wrangler; deployed 405/401 versus SPA behavior must still be verified.
- Deadline/cancellation behavior is tested locally; an already accepted D1 read
  may finish. No global replay ledger/quota or production conversation endpoint is
  introduced for this bounded operator-only proof.
- Configuration still has the preview D1 placeholder and no real account ID or
  cloud secrets. Probe enable/window remain false/UNCONFIGURED. The exact two
  Workers, one D1, required permissions, owner dashboard actions, command order,
  exposure checks, cleanup and safe rollback are in
  [the M2B-B runbook](m2b-deployment-plan.md).
- M2B-B needs separate explicit approval before login/resource creation/secrets/
  migration/deployment. Stop on Free CPU limits; no plan upgrade is authorized.
  After successful deployed proof remove the probe, then seek M3 approval for the
  shortest approved-text conversation path and M4 for synthetic voice.
