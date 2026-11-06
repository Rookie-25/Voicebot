# M2B preview deployment plan — approval required

Prepared 2026-11-06. **Nothing in this runbook has been executed against Cloudflare.**
M2A's official SDK client/server and private HTTP transport are retained. No LLM,
speech, real candidate data, production deployment or paid resource is included.

## Exact resource inventory

| Resource                                        | Name / setting                                           | Exposure                                                                 |
| ----------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------ |
| Preview gateway Worker with bundled demo assets | `voice-bot-gateway-preview`                              | HTTPS `workers.dev` URL; version-preview URLs disabled                   |
| Preview knowledge MCP Worker                    | `voice-bot-knowledge-preview`                            | `workers_dev:false`, `preview_urls:false`, `routes:[]`; no custom domain |
| Preview D1 database                             | `voice-bot-knowledge-preview`                            | Bound only to knowledge Worker as `DB`                                   |
| Private HTTP service binding                    | Gateway `KNOWLEDGE_MCP` -> `voice-bot-knowledge-preview` | No public MCP forwarding route                                           |
| Preview service secret                          | `MCP_SERVICE_SECRET` on both Workers                     | Same newly generated preview key; never reuse local/production keys      |
| Temporary operator secret                       | `M2B_OPERATOR_TOKEN` on gateway only                     | Separate random token, removed after verification                        |
| Temporary operator probe                        | Gateway `POST /ops/mcp-probe`                            | Preview-only, authenticated, expires; removed after verification         |

No third Worker, Durable Object, Redis, vector database, queue, domain, provider
account or subscription is needed for this proof. D1 migrations create the existing
knowledge tables/views plus the migration ledger, not additional databases.

After authorization, inspect the selected account for these exact names. If any
already exist, stop before modifying them and review ownership and existing state.
This plan does not authorize overwriting unknown resources. Enable a free account's
`workers.dev` subdomain through the dashboard if it has not yet been established.

## Local prerequisites implemented in M2B-A

1. `apps/gateway/src/m2b-probe.ts` implements the temporary HTTP probe using the
   existing real SDK client and private binding. `McpDiagnostics.probe` remains
   local-only. No REST retrieval or direct repository import replaces MCP.
2. Preview assets explicitly dispatch `/ops/mcp-probe` to Worker code. The module
   enforces preview mode, enable flag, strict UTC start/expiry window <= one hour,
   POST, no browser Origin/CORS, no-store, 2 KiB JSON, native constant-time token
   comparison, two-second body timeout and ten-second overall/expiry deadline.
3. Input is only `{ "case": "<allowlisted-test>" }`. Fixed cases supply arguments
   and invalid service credentials internally. No raw data or exception message
   escapes; authentication happens before MCP construction. See
   [actual local results](m2b-a-verification.md) for focused unit/runtime coverage.
4. `tests/fixtures/preview-approved.sql` is the reviewed approved-public subset of
   existing fictional Alex data: one published version, profile/project/story,
   evidence, `intro` and `followup`, short/standard approved variants and links.
   Standard variants deliberately reuse approved short wording. Local D1 validates
   foreign keys and publication. Never upload `fictional-knowledge.sql` wholesale.
   SQL cannot identify cloud environments: reviewed UUID and explicit commands
   enforce preview targeting. No cloud upload or automatic remote seed exists.
5. Prepared preview-only configuration: both Workers use
   `CANDIDATE_ID=fictional-alex`, `CONTENT_VERSION=fixture-v1`, `APP_ENV=preview`;
   knowledge enables `ALLOW_SYNTHETIC_DATA=true`; gateway retains
   `LOCAL_MCP_DIAGNOSTICS=false`, adds `M2B_PROBE_ENABLED` and
   `M2B_PROBE_STARTS_AT` and `M2B_PROBE_EXPIRES_AT`. **Committed state is disabled**:
   `M2B_PROBE_ENABLED=false`, both timestamps `UNCONFIGURED`. Enable only after
   M2B-B approval, just before deploying the gateway for the operator window.
   Insert the returned D1 UUID only into preview `DB.database_id`; it is still a
   placeholder. Production settings remain untouched.
6. Review local evidence/diff and strict environment readiness before login. Stop
   heavy work below 2 GiB; prefer 5 GiB for heavy operations. No browsers, package
   installations or new SDK/framework are needed. The full historical suite was
   not repeated; focused M2B-A checks are documented separately.

Recover disk/memory headroom and run the deferred small unit/health regression
gate in `m2b-a-verification.md` before cloud authentication. The last C: low-water
sample was 2.156 GiB. Do not start a full build/test/browser run at this headroom.

## Account access and cost boundary

The owner signs into Cloudflare in their own browser using Wrangler OAuth. Never
paste login credentials, API tokens or service secrets into chat, Git, command
arguments, screenshots or saved transcripts. A Cloudflare account and an available
Workers/D1 free allowance are required; a credit-card purchase is not planned.
Wrangler may store a small OAuth credential file in the user's Windows profile;
do not relocate it by changing machine-wide paths. Project caches/logs stay on D:.

For a delegated identity, creating Workers currently requires **Workers product
Admin**, not merely Editor. Once created, per-Worker Editor is enough to deploy and
manage secrets; Metadata Read-Only permits tailing. D1 needs separate account D1
write/edit permission for creation/migration/query/export, plus read/list access.
Account discovery must be permitted or the owner must explicitly select the
account. No zone/DNS/Workers Routes permission is needed without custom domains.
OAuth permissions shown in the browser must be reviewed by the owner; OAuth can
request broader scopes than this two-Worker task. Prefer owner-controlled login
over sharing an account-wide token. Revoke/logout after verification if desired.

Official limits checked for this plan:

- Workers Free: 100,000 dynamic requests/day, 10 ms CPU per HTTP request, 128 MB
  memory and six simultaneous outgoing connections per request. Network/D1 waiting
  time does not count as CPU. Local success does not establish free-tier CPU fit.
- D1 Free: 5 million rows read/day, 100,000 rows written/day, 5 GB total storage,
  ten databases. Existing account usage shares these allowances.
- Expect $0 incremental platform cost for a small proof within an otherwise
  available free allowance: at most 50 sequential operator requests, no load test,
  only tiny fixtures and a handful of MCP messages per successful case. Check
  actual usage and CPU metrics; stop on limits or unexpected errors.
- SDK initialization, authentication and validation may exceed Free's 10 ms CPU
  budget, especially cold. Observe startup/CPU/errors in both Workers. Error 1102
  or sustained CPU failures is a blocker to investigate, not permission to upgrade.
  Workers Paid starts at $5/month plus applicable usage. Any upgrade requires
  separate explicit approval. Existing paid-account billing, if any, must be checked.
- No paid inference or speech APIs are called. A private binding is not evidence
  of MCP correctness: the deployed protocol and D1-backed results must be observed.

Sources: [Workers roles](https://developers.cloudflare.com/workers/authorization/workers/),
[Workers limits](https://developers.cloudflare.com/workers/platform/limits/),
[Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/),
[D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/),
[Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/).

## Exact PowerShell command sequence — after explicit approval only

Run from `D:\Projects\voice-bot`. Execute one command at a time; stop on nonzero
exit status. The local work listed above must be reviewed/tested first. Commands
below use installed workspace Wrangler, never a global install. Every cloud write
explicitly selects `preview`; no `--env production` is permitted.

```powershell
Set-Location D:\Projects\voice-bot
. .\scripts\dev-env.ps1
.\scripts\verify-env.ps1 -Strict
# Review docs/m2b-a-verification.md and the uncommitted diff first.
# After restored headroom, before login:
npm.cmd exec -- vitest run tests/m2b-probe.test.ts tests/workers.test.ts --maxWorkers=1
# Repeat heavy checks only if changes or unresolved concerns justify them.

# APPROVAL BOUNDARY: none of the following has been executed.
npm.cmd exec -- wrangler login
npm.cmd exec -- wrangler whoami
npm.cmd exec -- wrangler d1 list
```

The owner selects the intended account, verifies its plan/allowances and Workers
inventory in the dashboard, and confirms no name collision. Set the chosen public
account identifier process-locally to avoid ambiguous multi-account selection:

```powershell
$env:CLOUDFLARE_ACCOUNT_ID = '<owner-selected-account-id>'
npm.cmd exec --workspace @voice-bot/knowledge-mcp -- wrangler d1 create voice-bot-knowledge-preview
```

Review the returned UUID and update **only preview** DB configuration as described
above; do not accept an automatic edit that affects local/production bindings.
Confirm the reviewed approved-only seed exists, then:

```powershell
npm.cmd exec --workspace @voice-bot/knowledge-mcp -- wrangler d1 migrations apply DB --remote --env preview
npm.cmd exec --workspace @voice-bot/knowledge-mcp -- wrangler d1 execute DB --remote --env preview --file ../../tests/fixtures/preview-approved.sql

# Knowledge deploys first; absent service credentials must fail closed.
npm.cmd exec --workspace @voice-bot/knowledge-mcp -- wrangler deploy --env preview
npm.cmd exec --workspace @voice-bot/knowledge-mcp -- wrangler secret put MCP_SERVICE_SECRET --env preview
```

Immediately before gateway deployment, choose a 45-minute UTC window and review
the preview-only timestamp/enable edits. These commands print public timestamps,
not secrets; no account or Worker is changed by calculating them:

```powershell
$m2bStarts = [DateTime]::UtcNow
$m2bStarts.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'")
$m2bStarts.AddMinutes(45).ToString("yyyy-MM-dd'T'HH:mm:ss'Z'")
# Put these values into preview M2B_PROBE_STARTS_AT / M2B_PROBE_EXPIRES_AT.
# Set only preview M2B_PROBE_ENABLED=true. Review config diff before continuing.

# Gateway cannot probe until both its secrets have been entered.
npm.cmd exec --workspace @voice-bot/gateway -- wrangler deploy --env preview
npm.cmd exec --workspace @voice-bot/gateway -- wrangler secret put MCP_SERVICE_SECRET --env preview
npm.cmd exec --workspace @voice-bot/gateway -- wrangler secret put M2B_OPERATOR_TOKEN --env preview

npm.cmd exec --workspace @voice-bot/knowledge-mcp -- wrangler deployments list --env preview
npm.cmd exec --workspace @voice-bot/gateway -- wrangler deployments list --env preview
```

Generate two distinct random secrets of at least 32 bytes in an owner-controlled
password manager. The operator token MUST be encoded as exactly **64 lowercase
hexadecimal characters**; the probe rejects other formats. Enter the same
**new preview service key** into both service-key
prompts and the independent token into the operator prompt. Values go through
Wrangler's interactive secret input, never literal command arguments or committed
files. Each `secret put` immediately deploys a new Worker version: record final
post-secret version IDs, not just the initial deploy IDs.

In separate D:-configured terminals, collect redacted live events during the proof:

```powershell
npm.cmd exec --workspace @voice-bot/knowledge-mcp -- wrangler tail --env preview --format json
# In another terminal:
npm.cmd exec --workspace @voice-bot/gateway -- wrangler tail --env preview --format json
```

Record the URL emitted by gateway deployment. The following operator example is
the locally tested probe contract; it remains disabled until explicitly activated:

```powershell
$m2bBase = 'https://voice-bot-gateway-preview.<account-subdomain>.workers.dev'
Invoke-RestMethod -Uri "$m2bBase/healthz" -TimeoutSec 15
$m2bSecureToken = Read-Host 'Preview operator token' -AsSecureString
$m2bCredential = [pscredential]::new('operator', $m2bSecureToken)
$m2bHeaders = @{ Authorization = 'Bearer ' + $m2bCredential.GetNetworkCredential().Password }
try {
    foreach ($m2bCase in @(
        'profile', 'search', 'answer', 'answer-standard', 'followup',
        'missing-service-auth', 'invalid-service-auth',
        'wrong-candidate', 'wrong-environment', 'wrong-version', 'wrong-tool-version', 'insufficient-scope',
        'missing-answer', 'invalid-tool-input'
    )) {
        Invoke-RestMethod -Method Post -Uri "$m2bBase/ops/mcp-probe" `
            -Headers $m2bHeaders -ContentType 'application/json' `
            -Body (@{ case = $m2bCase } | ConvertTo-Json -Compress) -TimeoutSec 15
    }
} finally {
    $m2bHeaders.Clear()
    Remove-Variable m2bCredential,m2bSecureToken,m2bHeaders -ErrorAction SilentlyContinue
}
```

Plaintext headers necessarily exist briefly in operator process memory. Do not
enable HTTP debug dumps or record them. Negative cases should return sanitized
assertion reports; the harness must distinguish an expected MCP rejection from an
infrastructure/timeout failure. Missing/invalid **operator** token, expiry and
disabled/production checks are additional requests/local tests, not service-auth
cases. Do not deliberately alter live secrets to test invalid service credentials.

`invalid-tool-input` proves the existing gateway's Zod gate after initialization
and discovery; it intentionally emits no `tools/call`. M2A tests separately verify
invalid tool schemas over the actual protocol. Transport-auth denial cases emit
an attempted `initialize` and require the expected server status/error/trace; they
do not claim successful negotiation. Positive cases require all four protocol
methods, negotiated version/catalog, trace checks and valid synthetic content.
HTTP 200 means the requested assertion passed, including expected denial cases;
unexpected failures return 502. Early input/auth/method/deadline errors use
400/401/403/404/405/408/413/415/503/504 and never raw exception messages.

### Owner dashboard actions after M2B-B approval

1. Sign into the intended Cloudflare account personally; review OAuth scopes and
   confirm the account ID, Free plan and available Workers/D1 allowances. Do not
   purchase/upgrade a plan for this task without a separate decision.
2. Inspect Workers & Pages and D1 inventories for the exact proposed names; stop
   on collisions. Complete `workers.dev` subdomain onboarding only if required.
3. After approved CLI creation/deployment, inspect gateway preview settings:
   public workers.dev enabled, version-preview URLs disabled, correct private
   binding target. Inspect knowledge preview settings: workers.dev/version-preview
   URLs disabled, no routes/custom domains, correct preview DB binding/UUID.
4. Confirm secret names exist on the intended Workers without revealing values.
   Check preview candidate/version/fixture flags and the short probe window.
5. Observe both Workers' errors/CPU and D1 usage during the bounded proof. After
   probe removal confirm the token is removed, the endpoint cannot invoke MCP,
   private knowledge exposure remains disabled and no production resource changed.

## Evidence and acceptance checks

- `/healthz` is a process liveness check; successful tool calls establish D1 and
  binding readiness. Frontend remains the unchanged M1 demo, not an MCP chat UI.
- Each positive probe uses the gateway's actual official SDK client, canonical
  `https://knowledge.internal/mcp` HTTP request with `Host: knowledge.internal`,
  private service binding and official SDK/adapter server backed by **preview D1**.
  Never use the local test relay in deployment.
- Capture actual `initialize`, `notifications/initialized`, `tools/list` and
  `tools/call` metadata, negotiated revision `2025-11-25`, tools capability and
  exact three-tool catalog. Assert schema-valid results, expected synthetic IDs,
  published version, content hashes/evidence and one trace UUID shared across
  gateway transport, knowledge execution and response. The probe validates text
  hashes/evidence internally and emits booleans only, not hashes or content. No raw
  JWT/content logs. `checks.protocol` means the expected sequence for that case;
  only positive cases establish successful negotiation and invocation.
- All three tools succeed. Fixed missing/invalid service auth fails before data
  access; candidate/environment/version/scope tests fail as designed. Unknown
  answer and invalid input cannot yield approved text. No arbitrary tool/URL proxy.
- Verify knowledge settings in the authenticated dashboard: workers.dev disabled,
  version-preview URLs disabled, empty routes and no custom domain. A public
  unauthenticated request to its guessed workers.dev host must not reach MCP;
  DNS failure/404 alone is insufficient evidence without configuration inspection.
- Probe without/with wrong operator token fails without MCP calls; browser Origin
  is rejected; no CORS. Gateway `/mcp` and normal API paths must not forward MCP
  (an SPA 200 is not itself an exposed MCP service). Production local diagnostics
  remain disabled. Tail events/metrics show no unexpected public knowledge traffic.
- Run a small paired-request isolation check and an operator-abort case, within
  50 total requests. Record whether disconnect cancellation reaches the binding;
  already accepted D1 work may finish. Local timeout/cancellation tests remain
  the deterministic coverage; do not inject artificial production delays.
- Record timestamps, deployment IDs, SDK versions, cases/assertions, request/trace
  IDs, elapsed times, both Workers' CPU/error metrics and D1 usage under ignored
  `.local/artifacts/m2b/`. Summarize sanitized evidence in documentation for review.
  Without these results, deployed MCP compatibility is **unproven**.

## Disable probe, rollback and optional cleanup

After collecting evidence, remove the temporary route/dispatch/code and its asset
routing exception, remove probe enable/expiry vars, locally test and redeploy only
the preview gateway. Verify the route no longer invokes MCP, then remove its token:

```powershell
npm.cmd exec --workspace @voice-bot/gateway -- wrangler deploy --env preview
npm.cmd exec --workspace @voice-bot/gateway -- wrangler secret delete M2B_OPERATOR_TOKEN --env preview
```

Record the final probe-free version. Stop live tails with Ctrl+C. If failure occurs,
disable the probe first; roll back only to a recorded compatible, safe preview
version. Never restore a probe-enabled version merely to restore a deployment.
Code rollback does not undo D1 schema/data or necessarily restore removed secrets.
Use the dashboard to disable public gateway access if deployment is unavailable.
For complete code cleanup remove `apps/gateway/src/m2b-probe.ts`, its import/dispatch
in `index.ts`, preview `M2B_*` vars and asset exception, operator placeholder in
`.env.example`, and temporary probe unit/integration cases. Retain approved fixture
validation as a storage test and retain sanitized verification documentation.

```powershell
# Only if such a previously recorded safe version exists:
npm.cmd exec --workspace @voice-bot/gateway -- wrangler rollback <safe-version-id> --env preview
```

For a first deployment there may be no safe prior version. Keep MCP fail-closed
and redeploy the reviewed probe-free gateway, or request removal of the newly
created preview resources. For useful fixture state, export before cleanup:

```powershell
npm.cmd exec --workspace @voice-bot/knowledge-mcp -- wrangler d1 export DB --remote --env preview --output ../../.local/artifacts/m2b-preview-backup.sql
```

**Destructive resource cleanup needs separate confirmation**, exact ownership/UUID
verification and review of the selected preview names. The following are reference
commands only; never execute them automatically or against production:

```powershell
npm.cmd exec --workspace @voice-bot/gateway -- wrangler delete --env preview
npm.cmd exec --workspace @voice-bot/knowledge-mcp -- wrangler delete --env preview
npm.cmd exec --workspace @voice-bot/knowledge-mcp -- wrangler d1 delete voice-bot-knowledge-preview --env preview
# Optional owner decision: end the local OAuth session.
npm.cmd exec -- wrangler logout
```

## Approval checkpoint

Local M2B-A preparation is authorized and delivered; cloud work is not. Approve
M2B-B owner-controlled Cloudflare login, the two named preview Workers, one named preview D1 database,
their preview secrets/binding, synthetic-only migration/seed, limited protocol and
security probes, and probe removal? No paid plan, real candidate data, production
deployment, M3/M4 or destructive resource cleanup is included. If Free CPU limits
block proof, stop and report before requesting any paid upgrade.
