# Persona — AI interview voice bot

A premium dark interview interface and Cloudflare-ready TypeScript foundation.
The **frontend remains the M1 interface preview** with local scripted responses.
No candidate biography, recording, playback or inference is active in the UI.
Public preview: https://voice-bot-gateway-preview.sagnikroy4002.workers.dev

M2B proves genuine authenticated MCP across deployed private Worker bindings and
preview D1. The temporary operator probe has been removed; the frontend does not
call MCP yet. Free-plan CPU headroom still needs follow-up before public AI traffic.
See [M2B deployed verification](docs/m2b-b-verification.md) and
[M2A local protocol evidence](docs/m2a-mcp.md). M3/M4 are not implemented.

## Windows PowerShell quick start

```powershell
Set-Location -LiteralPath 'D:\Projects\voice-bot'
. .\scripts\dev-env.ps1
.\scripts\verify-env.ps1 -Strict
npm.cmd ci --offline=false
npm.cmd run dev
```

Open **http://127.0.0.1:5173**. In a new terminal, load the environment again.
Never install global packages. The portable Node runtime, npm cache, temporary
files, Vite cache, browser artifacts and local state stay on D:. The npm cache in
`.npmrc` is intentionally specific to this Windows workspace; CI overrides it.

The UI supports questions, follow-ups, cancel/Escape, reset, sample questions,
and an audio preference preview. The microphone button explains the unavailable
recording capability and focuses text input. No microphone permission is requested.
Audio preference is in-memory only; it does not play sound.

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

Start the Worker skeletons in separate terminals **after building the frontend**:

```powershell
npm.cmd run dev:knowledge
# Another initialized PowerShell terminal:
npm.cmd run dev:gateway
Invoke-RestMethod 'http://127.0.0.1:8787/healthz'
Invoke-RestMethod 'http://127.0.0.1:8788/healthz'
```

Both commands use local Workers runtime emulation, loopback listeners, and D:
persistence. The gateway serves the built frontend and reserves `/api/v1/*` with
honest `501 NOT_IMPLEMENTED` errors. M2A's private knowledge `/mcp` requires internal
service authentication and a canonical Host; do not expose it to browsers. Tests
exercise the real MCP client and server. Its `/healthz` is process health only.

## Project map

| Location             | Responsibility                                                 |
| -------------------- | -------------------------------------------------------------- |
| `apps/web`           | React/Vite, CSS tokens, UI state machine, local demo adapter   |
| `apps/gateway`       | Public Worker, security headers, health, reserved API prefix   |
| `apps/knowledge-mcp` | Independently deployable private Worker skeleton               |
| `packages/contracts` | Strict Zod contracts and inferred TypeScript types             |
| `tests`              | Contract, state-machine, Worker runtime and browser tests      |
| `scripts`            | Environment safety, portable tools, artifact checks            |
| `docs`               | Architecture, security, milestones and deployment instructions |

CSS custom properties and focused CSS replace Tailwind for M1: this small screen
does not need another styling compiler. Tokens, responsive rules and component
boundaries remain explicit. No external fonts, icon library, heavy 3D or UI kit.

## Publication

Local work only. Do not authenticate, provision, or deploy without explicit
approval. See [deployment instructions](docs/deployment.md). Keep the future Git
repository private. Inspect staged content; never commit credentials or recordings.

## Documentation

- [Architecture](docs/architecture.md)
- [Security and privacy](docs/security.md)
- [Milestones](docs/milestones.md)
- [M0 environment setup](docs/milestone-0.md)

Next: M2 must prove a real deployed MCP client/server initialization, capability
discovery and tool call before substantial agent functionality. It requires new
authorization; M1 does not implement or simulate that protocol.
