# Milestone 0: Windows development readiness

Update: the subsequently authorized old C: npm cache cleanup is recorded in
`milestone-0-cache-cleanup.md`. Cleanup statements below describe the initial
environment-preparation stage; consult the newer report for current disk status.

Only environment preparation is authorized. No application code, package.json,
application dependencies, browser binaries, cloud services, or deployments have
been created. No existing files have been moved or deleted. No Git repository or
remote has been created; repository visibility must be configured as private when
repository setup is authorized.

## Findings

- Windows 11, x64.
- Initial C: free space: approximately 230 MiB (0.22 GiB).
- Initial D: free space: approximately 76.9 GiB.
- Existing Node: v20.10.0, in C:\Program Files\nodejs; npm 10.8.1.
- Git: 2.42.0.windows.2, on C:. Codex executable already resides on D:.
- Current Vite requires Node 20.19+ or 22.12+ (some templates require more).
- Use maintained Node 24 LTS for this project. The official release index checked
  during M0 lists v24.22.2, Windows x64 ZIP, with bundled npm 11.19.1.
- Existing TEMP and TMP pointed to the C: user profile.

## What is configured

Run in a new PowerShell session, before npm, Playwright, or build commands:

```powershell
Set-Location -LiteralPath 'D:\Projects\voice-bot'
. .\scripts\dev-env.ps1
.\scripts\verify-env.ps1
```

Dot-sourcing is necessary so environment changes persist in your interactive
shell. The scripts do not modify the machine/user environment, PowerShell profile,
registry, HOME, USERPROFILE, CODEX_HOME, or existing Node installation. Closing the
shell discards process environment changes. The same paths must be applied inside
future IDE tasks/terminals; a separately launched IDE does not inherit them.

| Data | D: path / setting |
| --- | --- |
| Temporary files | `.local\tmp` via TEMP and TMP |
| npm cache | `.local\npm-cache`, environment and project `.npmrc` |
| npm logs | `.local\logs\npm` |
| npm global prefix | `.local\npm-global` (no global packages installed) |
| npm user configuration | `.local\npmrc`, isolating home configuration |
| Playwright browser binaries | `.local\playwright` via PLAYWRIGHT_BROWSERS_PATH |
| Playwright future test artifacts | Reserved `.local\artifacts\playwright` |
| Tools honoring XDG_CACHE_HOME | `.local\cache` |
| Wrangler logs | `.local\logs\wrangler.log` via WRANGLER_LOG_PATH |
| Wrangler metrics | Disabled for this shell |
| Portable tools and ZIPs | `.local\tools` and `.local\downloads` |
| Future Wrangler persistence | Reserved `.local\state`; configure --persist-to per Worker |
| Future Vite cache/build output | Must be configured on D: during M1 |

PLAYWRIGHT_BROWSERS_PATH does not redirect test reports or browser channels such
as an installed system Chrome/Edge. Future Playwright configuration must explicitly
set output/report directories. XDG_CACHE_HOME is advisory, not a universal cache
override. No dependencies are installed just to test these future settings.

Wrangler is not installed or authenticated. Its persistent auth/global configuration
may still use a user-profile directory; audit the pinned version before first use.
Do not repurpose APPDATA or LOCALAPPDATA globally to work around this. node_modules,
bundler outputs and local Worker state remain under this D: repository.

`.gitignore` excludes local tools/caches, credentials, common build/test artifacts,
and recordings. Examples must contain placeholders only. Inspect every staged
file before committing. Never upload a token or private transcript in a test report.

## Portable Node integrity

The tooling-only installer is:

```powershell
.\scripts\install-portable-node.ps1
. .\scripts\dev-env.ps1
node --version
npm.cmd --version
```

It downloads the Windows x64 ZIP directly from official nodejs.org HTTPS, compares
its SHA-256 to the official release SHASUMS256.txt, and refuses to extract or run
the binary if the checksum differs. It refuses to overwrite an existing tool
directory. It leaves the archive/manifest on D: for review and records the source,
checksum and version in `.local\tools\node-install.json` after verification.

The checksum comparison verifies integrity against a manifest obtained from the
same official HTTPS origin. Detached-signature verification is not performed; do
not describe this as independent signature verification.

Existing Node on C: is left intact. The verified portable runtime is prepended to
PATH only by the session script. Use npm.cmd to avoid npm.ps1 execution-policy
ambiguity. No application packages are installed by this procedure.

## C: recovery candidates -- approval required

Read-only inspection found:

- `C:\Users\SAGNIK\AppData\Local\npm-cache`: approximately 1,589 MiB.
- Top-level files in `C:\Users\SAGNIK\Downloads`: approximately 993 MiB.

The npm cache is regenerable, but cleanup is not authorized and has NOT been run.
It may be used by other projects. After specific approval, prefer npm's supported
cache-clean operation with the exact old cache path; do not accidentally target
the new D: cache. Downloads are personal files: select exact items and verify
destination/available space before any approved move. Neither location is touched
by the environment scripts. Inspect Windows Storage recommendations manually;
do not bulk-delete Windows, AppData, recovery, update, or personal files.

Removing the old npm cache alone would leave only approximately 1.78 GiB free.
Additional reviewed recovery would be needed to pass the 2 GiB readiness policy.

Windows, browser profiles, the editor, Codex/auth tooling, credential managers,
crash reporters and some installers can still write to C:. D: redirects do not
make running Windows at 230 MiB free reliable.

## Readiness and verification

```powershell
.\scripts\verify-env.ps1 -Strict
Get-Command node.exe,npm.cmd | Select-Object Name,Source
npm.cmd config get cache
Get-PSDrive -Name C,D | Select-Object Name,Free
Get-Content -LiteralPath '.local\tools\node-install.json'
```

The verification policy requires at least 2 GiB free on C: and 10 GiB on D: before
future dependency installation/builds. These are project safety thresholds, not
vendor installation minimums; several additional GiB on C: is preferable.
The non-strict check prints failures without throwing; -Strict throws so future
installation/build scripts can stop. No readiness check installs packages or
removes data. Tooling preparation on D: does not itself clear the C: blocker.

M1 requires separate authorization even after readiness passes. M2 must prove the
complete deployed MCP client/server protocol path before substantial agent work.
The premium dark UI, accessibility, responsiveness and conversational quality
remain product requirements. Redis, Kubernetes, vector databases, voice cloning
and an admin dashboard remain excluded from the initial release.

## Official references

- https://nodejs.org/dist/index.json
- https://nodejs.org/dist/v24.22.2/SHASUMS256.txt
- https://vite.dev/guide/
- https://developers.cloudflare.com/workers/wrangler/install-and-update/
- https://developers.cloudflare.com/workers/wrangler/system-environment-variables/
- https://developers.cloudflare.com/workers/local-development/local-data/
- https://playwright.dev/docs/browsers

See `milestone-0-verification.md` for the actual completion results.
