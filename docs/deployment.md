# Deployment preparation — do not execute without approval

M1 contains deployable configuration but has not authenticated, created cloud
resources or published anything. Local `build` commands use `--dry-run` only.

**M2A update:** all cloud actions remain unauthorized. Current D1 IDs are explicit
non-resource placeholders for local emulation, not deployed bindings. The older
M1 deployment outline below is insufficient for M2B: review the resources,
permissions and gated diagnostic plan in [M2A](m2a-mcp.md) before any cloud action.

## Required owner setup after authorization

1. A Cloudflare account with Workers access and an account workers.dev subdomain.
2. A narrowly scoped API token for Worker deployments, handled through the secure
   environment/CI secret mechanism. Do not paste credentials into source or logs.
3. Confirm gateway hostname, account limits, preview access and intended audience.
4. Deploy knowledge before gateway because the latter declares its service binding.
5. Use distinct preview and production names already defined in both configs.

No D1, Durable Objects, inference accounts or paid plans are required by M1. Adding
them later requires explicit authorization and separate configuration.

## Exact proposed commands

Run from the repository root with the D:-local environment loaded. Authentication
is an owner step after approval; no command below has been executed for publication.

```powershell
npm.cmd run check

# Preview, knowledge first:
npm.cmd exec --workspace @voice-bot/knowledge-mcp -- wrangler deploy --env preview
npm.cmd exec --workspace @voice-bot/gateway -- wrangler deploy --env preview

# Production, only after reviewing preview:
npm.cmd exec --workspace @voice-bot/knowledge-mcp -- wrangler deploy --env production
npm.cmd exec --workspace @voice-bot/gateway -- wrangler deploy --env production
```

Knowledge sets `workers_dev: false`, `preview_urls: false`, and `routes: []` at
every level. Do not add a custom domain or public route in the dashboard. Check
dashboard settings as well as source before publication. The public gateway is the
only intended browser entry point, with static assets and same-origin APIs.

Preview gateway binds `voice-bot-knowledge-preview`; production gateway binds
`voice-bot-knowledge`. Never reuse production bindings in preview. Environment
variables and service bindings are declared explicitly per environment.

## Verification after a future deployment

- GET /healthz returns service=gateway, mode=skeleton, milestone=M1.
- The root UI loads with asset security headers and correct demo disclosures.
- POST /api/v1/turn returns 501, never a fabricated answer.
- No public knowledge URL, preview URL or route is exposed.
- Version identifiers and the content of the release are recorded for rollback.

Rollback the gateway using its recorded previous Worker version, then verify the
health/UI. M1 has no database migrations to reverse. Future schema changes must be
backward compatible; Worker rollback alone does not roll back database state.
