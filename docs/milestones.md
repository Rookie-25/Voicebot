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

## M2A — local implementation/protocol proof and browser closure complete

Official SDK client/server 2.4.0 and Cloudflare agents 0.33.0 HTTP adapter are
integrated with private service authentication and local D1. Synthetic fixtures
are explicitly fictional. Protocol/security tests exercise real workerd bindings.
29 tests and full lint/type/build checks passed. No deployed verification is claimed.
The original final environment check failed after C: fell below 2 GiB. After the
user's Windows restart, strict verification passed all 14 checks and the four
deferred browser tests passed. C: then declined from 6.77 to 3.23 GiB, so the
previously passing full suite was not repeated. No application code changed.
See `m2a-verification.md` for dated results, historical evidence and limits.

## M2B — deployed protocol/security/cleanup passed; Free CPU follow-up remains

M2B-A prepared the real SDK path and fixtures; the owner reported 60 preparation
tests passing. Authorized M2B-B deployed the two preview Workers and used existing
approved-only synthetic D1 data, without recreating/reseeding it. Fourteen real MCP
cases, two concurrent checks and six operator checks passed. The temporary probe,
its token/config and test suites were retired; fixture validation remains. Ten
focused cleanup regression tests passed. No UI, dependency, paid-plan or production
deployment change occurred. See `m2b-b-verification.md` for evidence and active URL.

Overall M2B-B is PARTIAL on performance readiness: measured CPU samples exceeded
Free's nominal 10 ms despite successful requests/no observed resource-limit errors.
Profile/optimize and remeasure before promising Free capacity. No upgrade is
authorized, and M3/M4 do not start automatically. Owner local/production binding
edits are preserved outside the milestone commit.

## Accelerated M3/M4 — local verification passed; live activation awaits key

Update: key and session are now proper preview secrets, updated Workers/frontend
and SQLite quotas deployed. Two live requests failed on OpenAI HTTP 429; inference
was disabled using a verified new M3/M4 version. C: also fell below 2 GiB. See
`m3-m4-live-activation.md`; provider access and public voice proof remain blocked.

Prepared real approved-answer text API, minimal OpenAI selector, atomic quota
actor, signed sessions/context, API-connected UI and browser speech controls.
Closure passed 48 focused and eight lightweight regression tests serially, strict types, lint, selected formatting,
frontend/Worker dry-run builds and credential scan. Two focused Edge journeys passed:
actual local text -> private MCP -> approved D1 with follow-up, and separately
emulated speech review/playback controls. Real microphone/audio-device operation is
unverified. Preview has no OpenAI key; owner requested local verification first.
Quota actor was exercised locally, not provisioned in cloud. No deployment or paid
inference occurred. Public URL remains the previous scripted demo.
See `m3-m4-implementation.md`; do not call the assessment submission-ready.

## M3–M6 scope

M3: approved-answer orchestration and guardrails. M4: real synthetic voice input /
output. M5: quotas, hardening and instrumentation. M6: public release verification.

Premium UI/UX, accessibility, responsiveness, natural conversational behavior and
latency remain product requirements throughout. Redis, Kubernetes, vector databases,
voice cloning and an admin dashboard remain excluded from the initial release.
