# Persona — AI interview voice bot

A premium dark interview interface and Cloudflare-ready TypeScript foundation.
Local M3/M4 text/MCP/D1, follow-ups, quotas and browser controls are verified.
Live activation awaits the owner's securely entered OpenAI key and cloud smoke
tests. The owner approved the capped setup; public inference is disabled. See
[implementation and exact resume steps](docs/m3-m4-implementation.md).
The **deployed frontend remains the M1 interface preview** with local scripted responses.
No live AI or speech is active on the public URL yet.
Public preview: https://voice-bot-gateway-preview.sagnikroy4002.workers.dev

M2B proves genuine authenticated MCP across deployed private Worker bindings and
preview D1. The temporary operator probe has been removed; the frontend does not
call MCP yet. Free-plan CPU headroom still needs follow-up before public AI traffic.
See [M2B deployed verification](docs/m2b-b-verification.md) and
[M2A local protocol evidence](docs/m2a-mcp.md). Local M3/M4 uses explicitly fictional content.

## Windows PowerShell quick start

```powershell
Set-Location -LiteralPath 'D:\Projects\voice-bot'
. .\scripts\dev-env.ps1
.\scripts\verify-env.ps1 -Strict
.\scripts\init-interview-local.ps1
# Separate initialized terminals:
npm.cmd run dev:interview:knowledge
npm.cmd run dev:interview:gateway
npm.cmd run dev
```

Open **http://127.0.0.1:5173**. In a new terminal, load the environment again.
Never install global packages. The portable Node runtime, npm cache, temporary
files, Vite cache, browser artifacts and local state stay on D:. The npm cache in
`.npmrc` is intentionally specific to this Windows workspace; CI overrides it.

The local UI supports typed questions, signed follow-ups, concise/standard approved
answers, cancel/Escape and reset. It clearly labels the deterministic test selector;
this is not live AI. Enable browser speech processing in Audio preferences for
dictation, review the transcript, then ask. Speech output uses an available synthetic
browser voice with stop/replay controls. Recognition support varies by browser and
may involve vendor processing. Real microphone/audio-device operation needs manual testing.

## Commands

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
npm.cmd test
npm.cmd run build
npm.cmd run check
npm.cmd run test:browser
```

Browser tests use an existing Microsoft Edge installation on Windows, without
downloading browsers. Reports and screenshots go to `.local/artifacts/playwright`.
If Edge is unavailable, do not install browser binaries without reviewing disk
space and necessity. Linux browser tests need a separately prepared Chromium;
ordinary CI runs unit/component/runtime tests and builds without a browser.

The isolated interview commands above are recommended. Generic legacy Worker
commands remain available for development **after building the frontend**:

```powershell
npm.cmd run dev:knowledge
# Another initialized PowerShell terminal:
npm.cmd run dev:gateway
Invoke-RestMethod 'http://127.0.0.1:8787/healthz'
Invoke-RestMethod 'http://127.0.0.1:8788/healthz'
```

Both commands use local Workers runtime emulation, loopback listeners, and D:
persistence. The gateway serves the built frontend; `/api/v1/turn` fails closed
without configured provider, session and quota prerequisites. Private `/mcp` requires internal
service authentication and a canonical Host; do not expose it to browsers. Tests
exercise the real MCP client and server. Its `/healthz` is process health only.

## Project map

| Location             | Responsibility                                                 |
| -------------------- | -------------------------------------------------------------- |
| `apps/web`           | React/Vite, UI state machine, API client, browser speech       |
| `apps/gateway`       | Public Worker, grounded turn API, sessions and quotas          |
| `apps/knowledge-mcp` | Private official MCP server and approved D1 retrieval          |
| `packages/contracts` | Strict Zod contracts and inferred TypeScript types             |
| `tests`              | Contract, state-machine, Worker runtime and browser tests      |
| `scripts`            | Environment safety, portable tools, artifact checks            |
| `docs`               | Architecture, security, milestones and deployment instructions |

CSS custom properties and focused CSS replace Tailwind for M1: this small screen
does not need another styling compiler. Tokens, responsive rules and component
boundaries remain explicit. No external fonts, icon library, heavy 3D or UI kit.

## Publication

Preview infrastructure exists. Capped preview AI activation is approved but awaits
secure credentials and live verification. No production deployment or paid plan is
authorized. Keep candidate material private; never commit credentials or recordings.

## Documentation

- [Architecture](docs/architecture.md)
- [Security and privacy](docs/security.md)
- [Milestones](docs/milestones.md)
- [M0 environment setup](docs/milestone-0.md)

Next: enter the OpenAI key through Wrangler, activate the approved preview cap,
verify real inference and perform owner-operated microphone/playback testing.
