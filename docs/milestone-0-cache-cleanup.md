# Authorized old npm cache cleanup

Date: 2026-11-06. Scope: only the old npm cache at
`C:\Users\SAGNIK\AppData\Local\npm-cache`.

## Verification and operation

- Directory existed and resolved to the exact authorized C: path.
- No reparse points were found in the target tree before cleaning.
- The active project cache independently resolved to
  `D:\Projects\voice-bot\.local\npm-cache` and was not targeted.
- Old C: cache initially contained 1,666,322,964 bytes in 4,795 files.
- Used portable D: Node/npm with D:-local temporary files and npm logs.
- Executed only npm's supported cleanup command:

```powershell
npm.cmd cache clean --force --cache 'C:\Users\SAGNIK\AppData\Local\npm-cache'
```

The command exited successfully. No additional deletion or moving was performed.

## Measured result

| Measurement | Bytes | Approximate size |
| --- | ---: | ---: |
| Old cache before | 1,666,322,964 | 1.55 GiB |
| Old cache after | 48,124,284 | 45.9 MiB |
| File-content bytes removed | 1,618,198,680 | 1.51 GiB |
| C: free immediately before | 58,077,184 | 55.4 MiB |
| C: free immediately after | 1,664,770,048 | 1.55 GiB |
| Observed net free-space increase | 1,606,692,864 | 1.50 GiB |

File-content bytes and drive free-space changes differ because of filesystem
allocation and concurrent activity. Later sampling showed C: at **0.533 GiB**
and D: at **76.437 GiB**. The cause of the later free-space reduction is unverified;
do not attribute it to any specific process without further evidence.

npm left `_logs`, `_npx`, and `_update-notifier-last-checked` entries. These were
not manually removed. The effective npm cache remained on D: after cleaning.

## Additional read-only inspection

Only metadata was inspected. No other cache, personal file, Windows file, or
Download was cleaned or moved. Directory traversal skipped reparse points.

| Recovery candidate | Measured content | Risk and proposed method, requiring separate approval |
| --- | ---: | --- |
| User Temp | 1,501.7 MiB | Medium: some files may be active or needed for recovery. Review stale files; close relevant apps; exclude active files and links. Full size is an upper bound, not guaranteed recovery. |
| Downloads, including subdirectories | 1,101.9 MiB | Personal data: select exact files for a verified move to D:, preserving contents; do not bulk-delete. |
| VS Code cached extension packages | 454.7 MiB | Low-to-medium: regenerable packages, but close VS Code first; future reinstall may need download. |
| VS Code CachedData and Cache | 134.5 MiB combined | Low-to-medium after closing VS Code; regenerated caches may temporarily slow startup. |
| Old npm `_npx` | 45.9 MiB | Small benefit; cached tools may be referenced. No additional cleanup authorized. |
| Chrome and Edge Default Cache | 16.3 MiB combined | Too little benefit for the current blocker; leave alone. |
| pip cache | 0.5 MiB | Negligible benefit; leave alone. |

Largest candidates are listed first. For low-risk regenerable data, the VS Code
cache locations provide about 589 MiB combined, but this alone is insufficient
given the later 0.533 GiB C: sample. A reviewed combination of stale Temp data and
regenerable caches, or selected Downloads moved to D:, is needed. Aim above the
2 GiB threshold with a buffer because available space is changing substantially.

Exact inspected VS Code paths:

- `C:\Users\SAGNIK\AppData\Roaming\Code\CachedExtensionVSIXs`
- `C:\Users\SAGNIK\AppData\Roaming\Code\CachedData`
- `C:\Users\SAGNIK\AppData\Roaming\Code\Cache`

Machine-readable observations are in ignored `.local\artifacts`:
`npm-clean-baseline.json`, `npm-clean-result.json`, and
`disk-recovery-inspection.json`.

## Status

M0 remains blocked: C: is below the 2 GiB readiness policy. No M1 work,
application dependency installation, deployment, or provisioning was started.
Any additional cleanup requires explicit approval of its scope.
