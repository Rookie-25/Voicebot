# Security and privacy

## M3/M4 local controls (not deployed)

The turn API now validates strict JSON, Origin, request size and deadlines. Signed
HttpOnly SameSite sessions and bounded signed follow-up context bind candidate,
version and session. An atomic SQLite quota actor reserves $0.05 per admission,
with a $1 UTC-day ceiling, two concurrent leases and session/IP-hash limits.
This is application admission control, not an OpenAI billing guarantee. Failed
attempts retain their reservation. The actor stores no raw IP, question or audio.

The model selects only an allowlisted approved answer ID/null. Exact answer text
is re-fetched through official private MCP and validated for approval, scope,
version and evidence. No model-written personal claims are spoken. Incorrect
selection and prompt injection remain residual risks; unsupported prompts receive
a fixed fallback. Provider errors are sanitized, requests bounded, retries disabled.
The deterministic selector is local-only; preview rejects the test flag and fails
closed without live provider/session/budget configuration.

Browser-native recognition requires explicit consent and a user gesture. The
browser vendor may process microphone audio. Synthesis uses an available synthetic
voice, never a clone. This app does not retain recordings or log raw transcripts;
`store:false` is not a promise of zero provider retention. The recognition service
and OpenAI processing must be disclosed before real candidate publication.

Tests verify these local controls, including timeout/access failures and real MCP
transport. Actual cloud quotas, provider access, CPU limits and real audio-device
operation still require live verification. Turnstile is deferred: authoritative
quotas limit admission now, but an attacker can exhaust the small shared budget.

## M2B-B deployed boundary and probe retirement

Deployed proof confirms private knowledge access via scoped service capabilities,
published fictional preview content and genuine SDK/HTTP binding calls. API settings
confirm workers.dev/version URLs disabled on knowledge, no public routes/domains,
and correct D1 identity. The public gateway retains its service key/binding but
has no public MCP forwarding or inference endpoint. The temporary operator module,
route/configuration and token were removed after proof. See
[verification](m2b-b-verification.md) for the live test matrix and metrics limitations.

Operator results and captured logs contain assertion/trace metadata only. Credentials
were generated locally, uploaded via sanitized Wrangler stdin, and backed up only
with Windows DPAPI under ignored D: state. No credential or authenticated header is
committed. The removed probe's historical version must never be used as rollback.
Free CPU capacity is not guaranteed: several measured samples exceed the nominal
10 ms budget despite successful requests and no observed CPU-limit failures.

## Temporary M2B preview operator boundary (historical; removed after proof)

The `/ops/mcp-probe` implementation is disabled by default and rejects local and
production environments even with a valid credential. Preview activation requires
explicit start/expiry UTC timestamps, a window no longer than one hour, fictional
candidate/version scope, and a separate 32-byte random operator token encoded as
64 lowercase hexadecimal characters. Native `node:crypto` `timingSafeEqual` compares
fixed-size validated credentials under the existing `nodejs_compat` flag.

Authentication precedes MCP client construction. Requests are POST-only, reject
all browser Origins, have no CORS, require JSON, and are capped at 2 KiB. Body reads
have a two-second deadline; the whole probe has a ten-second deadline capped by
the absolute expiry. Cancellation propagates to the client/binding and discards
late results. Only fixed test cases are accepted; no arbitrary credentials,
candidate scope, URLs or MCP requests may be supplied by callers. Responses project
only allowlisted metadata/checks, not tool output, approved text, hashes, JWTs,
database rows or exception messages. Failed dependencies cannot pass a denial test.

The official SDK, service capabilities, knowledge authorization and published views
remain the MCP/data boundary. The preview SQL contains only approved public fictional
rows; it cannot itself identify a Cloudflare environment. Upload safety depends on
reviewed preview DB UUID/configuration and explicitly approved `--remote --env preview`
commands. No automatic cloud seed script has been added.

The operator token is a bearer credential replayable within the enabled window if
stolen. There is no distributed probe quota; private read-only operations, a strong
short-lived access window, bounded requests and operator-only use limit exposure.
Do not expose it to the browser UI, enable HTTP debug logs or leave it enabled after
proof. Remove its module, route, preview asset exception, vars and secret after
verification; do not roll back to an enabled probe. No paid inference is authorized.

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
