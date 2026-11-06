# Local-only setup. No remote flags, account authentication or cloud creation.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'dev-env.ps1')
& (Join-Path $PSScriptRoot 'verify-env.ps1') -Strict
node scripts/init-interview-local.mjs
if ($LASTEXITCODE -ne 0) { throw 'Local secret initialization failed.' }
npm.cmd exec --workspace @voice-bot/knowledge-mcp -- wrangler d1 migrations apply DB --local --config wrangler.interview.local.jsonc --persist-to ../../.local/state/interview-knowledge
if ($LASTEXITCODE -ne 0) { throw 'Local migration failed.' }
$rows = npm.cmd exec --workspace @voice-bot/knowledge-mcp -- wrangler d1 execute DB --local --config wrangler.interview.local.jsonc --persist-to ../../.local/state/interview-knowledge --json --command 'SELECT COUNT(*) AS n FROM candidates'
if ($LASTEXITCODE -ne 0) { throw 'Local seed inspection failed.' }
$result = ($rows -join "`n") | ConvertFrom-Json
if ($result[0].results[0].n -eq 0) {
    npm.cmd exec --workspace @voice-bot/knowledge-mcp -- wrangler d1 execute DB --local --config wrangler.interview.local.jsonc --persist-to ../../.local/state/interview-knowledge --file ../../tests/fixtures/preview-approved.sql
    if ($LASTEXITCODE -ne 0) { throw 'Local approved seed failed.' }
}
Write-Host 'Local approved fixture ready. Start the knowledge and gateway dev commands in separate D:-configured shells.'
