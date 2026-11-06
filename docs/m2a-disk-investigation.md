# Read-only C: investigation

M2A preflight: all 14 environment checks passed. C: had approximately 4.55 GiB
free; D: approximately 75.46 GiB. No C: cleanup, moves or system changes occurred.

## Evidence

- M1 recorded C: going from 8.373 GiB to 4.730 GiB. Those are net drive samples,
  not file-allocation traces. No pre-M1 pagefile-size measurement exists.
- Windows CIM at M2A start reported `C:\pagefile.sys` with AllocatedBaseSize
  **7,199 MiB**, CurrentUsage 1,483 MiB and PeakUsage 1,740 MiB.
- A later M2A CIM query reported allocated size **10,292 MiB**, current usage
  1,623 MiB, peak usage 1,889 MiB. This establishes pagefile allocation growth
  during M2A, but cannot retrospectively prove the cause of the M1 decrease.
- Final CIM showed **11,474 MiB allocated**, current usage 2,200 MiB and peak
  2,513 MiB. Allocation grew **4,275 MiB (about 4.17 GiB)** during M2A, accounting
  for most of the contemporaneous C: loss. Other net changes remain unattributed.
  This strengthens the M2A explanation without proving M1 history.
- The old C: npm cache remained exactly 48,124,284 bytes, matching the prior
  post-cleanup report. It did not regrow to explain the M1 loss.
- User Temp measured 1,572,455,411 bytes, slightly less than the earlier
  1,574,620,222-byte read-only sample. No currently present files in the inspected
  Temp/cache/Wrangler trees had timestamps in the approximate M1 execution window.
- The C: Wrangler global directory contained one 55-byte file. Contents and auth
  material were not opened. C: `.wrangler` and `ms-playwright` directories were absent.
- Current Temp includes several 200 MiB `.wbt` files and old installers, predating
  M1; filename metadata alone does not establish which process wrote them.
- Protected pagefile/root-file metadata was unavailable through Get-Item, despite
  CIM returning pagefile allocation. This is a visibility limit, not proof of absence.

The strongest supported explanation is that pagefile growth can consume C: space
while project artifacts stay on D:. It is demonstrated in M2A and plausible for
M1. Other processes, Windows update/maintenance, browser/editor state and transient
files can affect net free-space samples; none is established as the M1 cause.
Timestamp inspection cannot identify files already removed, prove the original
writer, or rule out inaccessible locations and system-managed allocations.

## Changes and verification

No pagefile size, Windows setting, personal file, existing cache or system file was
modified. Do not delete or move the pagefile. Vitest parallelism is now capped at
two workers to reduce test-process memory pressure. All project caches, D1 state,
dependencies and temporary paths remain on D:. Recheck readiness before large jobs.

The final strict check **failed** after the completed test run. Direct .NET sampling
confirmed C: at 242,593,792 bytes (about 231 MiB), D: at 80,949,370,880 bytes (about
75.39 GiB). No further builds, installations or browser runs were started. Test-owned
workerd processes exited; personal browser/Node processes were not terminated.
Recovery or OS-setting changes need separate approval. Restore at least 2 GiB free
on C: before further heavy work.

Raw metadata reports live under ignored `.local/artifacts/m2a-*`. They contain no
file contents or credentials. Final disk observations are in `m2a-mcp.md`.
