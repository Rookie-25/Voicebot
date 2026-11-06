# Dot-source this file: . .\scripts\dev-env.ps1
# Only this PowerShell process and its children are changed.
$voiceBotRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if ([IO.Path]::GetPathRoot($voiceBotRoot) -ne 'D:\') {
    throw 'This development environment must be located on D:.'
}
$voiceBotLocal = Join-Path $voiceBotRoot '.local'
$voiceBotDirectories = @(
    'tmp', 'npm-cache', 'npm-global', 'playwright', 'state', 'logs',
    'tools', 'downloads', 'cache', 'artifacts', 'artifacts\playwright'
)
foreach ($voiceBotDirectory in $voiceBotDirectories) {
    New-Item -ItemType Directory -Path (Join-Path $voiceBotLocal $voiceBotDirectory) -Force | Out-Null
}

$env:VOICE_BOT_ROOT = $voiceBotRoot
$env:VOICE_BOT_LOCAL = $voiceBotLocal
$env:TEMP = Join-Path $voiceBotLocal 'tmp'
$env:TMP = $env:TEMP
$env:NPM_CONFIG_CACHE = Join-Path $voiceBotLocal 'npm-cache'
$env:NPM_CONFIG_PREFIX = Join-Path $voiceBotLocal 'npm-global'
$env:NPM_CONFIG_USERCONFIG = Join-Path $voiceBotLocal 'npmrc'
$env:NPM_CONFIG_LOGS_DIR = Join-Path $voiceBotLocal 'logs\npm'
$env:NPM_CONFIG_UPDATE_NOTIFIER = 'false'
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $voiceBotLocal 'playwright'
$env:XDG_CACHE_HOME = Join-Path $voiceBotLocal 'cache'
$env:WRANGLER_LOG_PATH = Join-Path $voiceBotLocal 'logs\wrangler.log'
$env:WRANGLER_SEND_METRICS = 'false'

# A verified portable runtime is activated only after its receipt exists.
$voiceBotReceiptPath = Join-Path $voiceBotLocal 'tools\node-install.json'
if (Test-Path -LiteralPath $voiceBotReceiptPath) {
    $voiceBotReceipt = Get-Content -LiteralPath $voiceBotReceiptPath -Raw | ConvertFrom-Json
    if ($voiceBotReceipt.version -notmatch '^v24\.\d+\.\d+$') {
        throw 'Unexpected portable Node version in the installation receipt.'
    }
    $voiceBotNodeDirectory = Join-Path $voiceBotLocal ('tools\node-' + $voiceBotReceipt.version + '-win-x64')
    if (-not (Test-Path -LiteralPath (Join-Path $voiceBotNodeDirectory 'node.exe'))) {
        throw 'The portable Node installation receipt exists, but node.exe is missing.'
    }
    $voiceBotPathParts = @($env:PATH -split ';' | Where-Object { $_ -and $_ -ne $voiceBotNodeDirectory })
    $env:PATH = (@($voiceBotNodeDirectory) + $voiceBotPathParts) -join ';'
}

Write-Host ('Development cache/temp paths use ' + $voiceBotLocal)
Write-Host 'No machine-wide settings were changed. Close this shell to discard environment changes.'
