# Security and privacy

## Current M1 controls

- No API keys or account credentials required; no cloud login or provisioning.
- Only local scripted UI messages; no recordings, inference, DB operations or MCP.
- No conversation localStorage/sessionStorage, cookies or backend persistence.
- React renders visitor input as text. No untrusted HTML or markdown renderer.
- Bounded question length, bounded history, cancellation and stale-result rejection.
- Shared closed Zod schemas reject additional fields.
- Gateway generates its own UUID request identifiers for errors.
- Gateway API/health use no-store and secure response headers; no wildcard CORS.
- Microphone/camera/geolocation are disabled at the gateway for M1.
- Knowledge Worker public routes and version-preview URLs are explicitly disabled
  for local, preview and production configurations.
- Dependencies are pinned in manifests and a lockfile; all packages are private.
- CI receives no cloud/provider secrets and contains no deployment step.
- Build scan checks common credential patterns, source-map exposure and JS size.

The artifact scan is a useful check, not proof of absence of every secret. No
candidate data or credential files were introduced; manually review future content
and environment use. VITE_* variables are public: never use them for provider keys.

## Threat boundaries still to implement

Before any paid inference, implement signed anonymous sessions, Origin/CSRF checks,
Turnstile validation, authoritative quotas, atomic spending reservations, replay
protection, request-size/time/concurrency caps and provider deadlines. Keep provider
keys in Worker secrets. Browser audio permissions must remain an explicit gesture.

M2 adds authenticated read-only MCP tools, strict schemas/results, published public
content projections, candidate/version scoping, timeouts and sanitized structured
logs. The private binding reduces exposure; it is not by itself MCP or complete
authorization. No browser may invoke arbitrary internal tools or supply TTS text.

No current route should be described as production AI. Health means the skeleton
is running; it does not check a provider, database or MCP service. Public production
routes on the gateway are configuration preparation, not a deployed resource.

## Operational hygiene

Keep Git private; review staged files. Do not commit .local, .env, .dev.vars, keys,
recordings, browser auth state or reports containing sensitive transcripts. Examples
contain comments/placeholders only. Windows credentials and system settings are
untouched. Dependency changes require lockfile review, tests and vulnerability
assessment. No automatic `npm audit fix --force`.

M1 dependency review aligned Miniflare with Wrangler's patched bundled runtime,
5.20261104.0-beta. Tests use its official compatibility converter. A scoped npm
override upgrades minimatch 7–10 to 11.0.1 for GHSA-g3hv-75wg-m249 in development
tooling. Node 24 meets its requirements; affected lint/test paths pass. Remove the
override when upstream tools adopt the patched major. No blanket forced upgrade
or global installation was performed.

Future third-party data retention must be disclosed explicitly; absence of local
storage is not a promise of zero provider retention. No prompt-injection or
hallucination defense should be represented as infallible.
