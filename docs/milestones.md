# Implementation milestones

## M0 — complete

Portable Node v24.22.2/npm v11.19.1, D:-local cache/temp configuration, and disk
readiness are verified. Historical M0 documents remain intact. On M1 entry,
Get-PSDrive returned null free-space values in the restricted host; verify-env.ps1
now falls back to .NET DriveInfo without lowering either readiness threshold.
All 14 checks subsequently passed. No personal files or machine settings changed.

## M1 — complete; awaiting review

- npm workspaces, strict TypeScript, shared lint/format tooling.
- Responsive premium dark React interface with local demo adapter.
- Typed states, bounded text input/history, cancellation/reset/stale suppression.
- Shared Zod contracts and independently configured Worker skeletons.
- Private knowledge Worker; no fake MCP, database, speech or AI behavior.
- Tests, CI without deployment, artifact checks and operator documentation.

Completion evidence is recorded in `m1-verification.md`: full checks, 15 automated
tests, four browser tests, local health smokes, screenshots and disk observations.
No cloud authentication, deployment or provisioning is authorized in this milestone.

## M2A — local implementation/protocol proof complete; disk readiness blocked

Official SDK client/server 2.4.0 and Cloudflare agents 0.33.0 HTTP adapter are
integrated with private service authentication and local D1. Synthetic fixtures
are explicitly fictional. Protocol/security tests exercise real workerd bindings.
29 tests and full lint/type/build checks passed. No deployed verification is claimed.
The final environment check failed after C: fell below 2 GiB; no further builds or
browser runs were started. See `m2a-verification.md` for results and limits.

## M2B — pending explicit cloud authorization

First prove the **deployed** official MCP client/server initialization, discovery,
tool invocation, authorization and trace path. Then add approved structured
knowledge and protocol/schema/security tests. A binding alone is insufficient.
Deployment and any cloud resources need explicit authorization before that proof.

## M3–M6 — not started

M3: approved-answer orchestration and guardrails. M4: real synthetic voice input /
output. M5: quotas, hardening and instrumentation. M6: public release verification.

Premium UI/UX, accessibility, responsiveness, natural conversational behavior and
latency remain product requirements throughout. Redis, Kubernetes, vector databases,
voice cloning and an admin dashboard remain excluded from the initial release.
