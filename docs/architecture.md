# Architecture and boundaries

## Current M2B-B deployment

The real gateway SDK client -> private HTTP MCP Worker -> preview D1 path has passed
deployed initialization/discovery/tool/security checks. The temporary operator HTTP
probe and token have been removed. Both Workers retain their private binding and
service credentials; the public browser remains the scripted M1 demo until M3/M4.
No public arbitrary-tool endpoint exists. See [deployed evidence](m2b-b-verification.md)
for exposure checks and the measured Free CPU risk requiring follow-up.

## M2B-A local preview preparation (historical; probe retired)

The temporary gateway `/ops/mcp-probe` is restricted to an explicitly enabled,
one-hour-or-shorter preview UTC window and a separate operator credential. It
accepts fixed diagnostic case IDs, not visitor questions or arbitrary MCP messages.
It uses the existing official gateway SDK client over the private HTTP binding.
Only sanitized assertions and correlation IDs are returned; approved content is
never included. Committed configuration leaves it disabled. Production and local
public routes cannot enable it. The local-only private RPC guard is unchanged.

```mermaid
flowchart LR
  Operator[Authenticated operator] -->|temporary preview HTTPS probe| Gateway[Gateway: official MCP client]
  Gateway -->|MCP Streamable HTTP over private service binding| Knowledge[Private knowledge MCP Worker]
  Knowledge --> D1[Preview D1: approved fictional fixture]
  Browser[Unchanged browser demo] --> Mock[Local scripted responses]
```

The preview configuration, approved-only SQL and two-Worker path are verified
locally. No Cloudflare login or deployed verification has occurred. See
[M2B-A verification](m2b-a-verification.md) and [deployment plan](m2b-deployment-plan.md).
Remove the temporary module/dispatch/configuration after M2B-B proof; it is not
the future public conversation endpoint. M3 text orchestration follows only after
deployed MCP proof, with M4 voice after that, without adding infrastructure here.

## M2A local implementation

The gateway now contains the official MCP client; the private knowledge Worker
contains the official server with Cloudflare's HTTP handler adapter and D1. A
local-only private RPC diagnostic invokes the gateway client through a genuine
HTTP service binding. No public MCP/diagnostic HTTP route or frontend connection
was added. See [M2A details](m2a-mcp.md) for protocol evidence and trust boundaries.
The M1 design below is retained as the historical foundation.

## M1 implementation

```mermaid
flowchart LR
  Browser[React interface] --> Demo[In-browser cancellable demo adapter]
  Browser -. future same-origin API .-> Gateway[Public gateway Worker]
  Gateway -. configured private HTTP binding; unused in M1 .-> Knowledge[Private knowledge Worker skeleton]
  Contracts[Shared Zod contracts] --> Browser
  Contracts --> Gateway
  Contracts --> Knowledge
```

The frontend makes no API or inference requests. Demo messages contain no candidate
facts. `requestDemoReply` is deliberately named and labeled as a local adapter;
future real services must be introduced through a separate boundary.

The typed reducer rejects stale completions by request ID. AbortController cancels
the timer adapter on Stop, Escape, reset, replacement and unmount. Message history
is bounded. All visitor text is rendered as React text nodes; no HTML interpretation.

Conversation states include idle, listening, processing, speaking, stopped and
error. Listening/speaking are reserved typed states; M1 never pretends to enter
them. Error handling is present even though the deterministic demo adapter has no
network dependency. Input limits and IME-safe Enter handling are enforced locally.

The gateway owns health and the future `/api/v1` boundary. The knowledge Worker
has no public routes, workers.dev endpoint or version-preview URL. The declared
HTTP service binding is private transport infrastructure only; it is unused in M1
and does not implement MCP. Neither Worker has a D1/Durable Object binding or key.

## Decisions

- npm workspaces: one lockfile and minimal build coordination.
- Strict TypeScript plus strict Zod objects at contract boundaries.
- React/Vite static output: no SSR needed for a conversation interface.
- CSS tokens: small, inspectable design system without a styling dependency.
- Shared system typography and inline SVG icons: no external font/image requests.
- Independently bundled Workers with separate preview/production binding names.
- No application auth, paid calls or database operations at this milestone.

The API returning 501 is a scope boundary, not an authorization system. Never add
paid operations before session, CSRF, quota and budget enforcement are implemented.

## Future approved architecture

The gateway orchestrator becomes a genuine official MCP client. The private Worker
adds the official MCP server and Streamable HTTP transport, approved D1 content,
read-only authorization and protocol tests. A Durable Object supplies atomic quota
and spending decisions. The launch strategy selects approved answer identifiers
and variants; no free-form candidate facts are generated. Synthetic preset speech
arrives in M4. Redis, vector databases, cloning and an admin dashboard are excluded.

## M2 gate

Before substantial agent code, prove the complete deployed private service-binding
path using a real MCP client: initialize, capability negotiation, tools/list,
tools/call, authorization failure, schema rejection and trace correlation. A direct
function call or ordinary REST JSON request does not satisfy this acceptance gate.
