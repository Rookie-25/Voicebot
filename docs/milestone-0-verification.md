# Milestone 0 verification results

Subsequent authorized old-cache cleanup and newer free-space observations are
recorded in `milestone-0-cache-cleanup.md`; this file retains the initial setup
verification results.

Verified on 2026-11-06. Scope: environment preparation only.

## Outcome

**D:-local tooling is configured. NOT READY for M1 dependency installation/builds:**
C: remains below the documented 2 GiB project headroom policy. No cleanup was
performed; reclaiming existing space requires specific approval.

## Executed checks

- All three PowerShell scripts passed syntax parsing.
- Official Node release index confirmed v24.22.2 is Node 24 LTS (Krypton), Windows x64.
- Portable ZIP downloaded directly from nodejs.org to `.local\downloads`.
- SHA-256 matched the official HTTPS manifest before extraction/execution:
  `CA1BFF5D8EAD13C9F2EA404A176DB46BD430704D5B5113734049FA365E7799E2`.
- No detached-signature verification was performed.
- `node.exe --version`: v24.22.2.
- `npm.cmd --version`: 11.19.1.
- `node.exe` resolved to
  `D:\Projects\voice-bot\.local\tools\node-v24.22.2-win-x64\node.exe`.
- Node's `os.tmpdir()` resolved to `D:\Projects\voice-bot\.local\tmp`.
- npm's effective cache, global prefix, and userconfig all resolved under `.local` on D:.
- TEMP/TMP, npm logs, Playwright browser path, XDG cache and Wrangler log settings
  all passed D:-local path checks.
- Loading the environment twice left exactly one portable-Node entry on PATH.
- Machine TEMP remained `C:\WINDOWS\TEMP`; user TEMP remained the existing C: user
  Temp path. Only the development process environment was changed.
- Git and Codex commands were available at their existing locations.
- `package.json`, `node_modules`, and `.git` were all absent.
- No cloud resources, credentials, application dependencies or browser binaries
  were provisioned or installed.

An earlier free-space sample showed C: at about 180 MiB. The final strict check
showed C: at about 0.33 GiB and D: at about 76.44 GiB. Free space fluctuates with
other Windows activity; these figures are observations, not a claim about which
process caused changes. The strict readiness gate was executed and correctly
rejected insufficient C: headroom; every other configured check passed.

## Still unverified / blocked

- C: recovery: old npm cache approximately 1.55 GiB, Downloads approximately
  0.97 GiB are review candidates only. Do not clean or move without approval.
- Application tool versions, Vite builds, Wrangler runtime and Playwright launches
  cannot be tested until dependency installation is authorized and disk readiness
  passes. M0 only validates their future path configuration.
- Future Vite cache/build directories, per-Worker Wrangler persistence and browser
  report locations must be configured during M1; there is no universal environment
  variable that redirects every build tool.
- Wrangler auth/global configuration and third-party installers may still use C:;
  inspect before use. Existing Windows/editor/browser/Codex state stays untouched.
- Git repository visibility is not configured because no repository was created.

## Next check after approved space recovery

```powershell
Set-Location -LiteralPath 'D:\Projects\voice-bot'
. .\scripts\dev-env.ps1
.\scripts\verify-env.ps1 -Strict
```

Proceed to M1 only when this passes AND M1 is separately authorized. The complete
deployed MCP protocol path remains an early M2 acceptance gate.
