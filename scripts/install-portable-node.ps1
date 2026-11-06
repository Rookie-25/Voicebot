# Milestone 0 tooling only: no application dependencies, global installer, or PATH changes.
param(
    [ValidatePattern('^v24\.\d+\.\d+$')]
    [string]$Version = 'v24.22.2'
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'dev-env.ps1')
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
if ((Get-PSDrive -Name D).Free -lt 2GB) { throw 'At least 2 GiB free on D: is required for tooling preparation.' }

$voiceBotNodeFile = 'node-' + $Version + '-win-x64.zip'
$voiceBotNodeBase = 'https://nodejs.org/dist/' + $Version
$voiceBotNodeArchive = Join-Path $env:VOICE_BOT_LOCAL ('downloads\' + $voiceBotNodeFile)
$voiceBotNodeManifest = Join-Path $env:VOICE_BOT_LOCAL ('downloads\' + $Version + '-SHASUMS256.txt')
$voiceBotNodeDestination = Join-Path $env:VOICE_BOT_LOCAL ('tools\node-' + $Version + '-win-x64')
$voiceBotNodeReceipt = Join-Path $env:VOICE_BOT_LOCAL 'tools\node-install.json'
if (Test-Path -LiteralPath $voiceBotNodeDestination) {
    throw ('Destination already exists; inspect it rather than overwriting: ' + $voiceBotNodeDestination)
}

$voiceBotRelease = Invoke-RestMethod -Uri ($voiceBotNodeBase + '/SHASUMS256.txt') -TimeoutSec 60
[IO.File]::WriteAllText($voiceBotNodeManifest, [string]$voiceBotRelease)
$voiceBotHashPattern = '(?m)^([a-fA-F0-9]{64})\s+' + [regex]::Escape($voiceBotNodeFile) + '\s*$'
$voiceBotHashMatch = [regex]::Match([string]$voiceBotRelease, $voiceBotHashPattern)
if (-not $voiceBotHashMatch.Success) { throw 'Official manifest contains no checksum for the requested Windows ZIP.' }
$voiceBotExpectedHash = $voiceBotHashMatch.Groups[1].Value.ToUpperInvariant()

Write-Host ('Downloading official ' + $voiceBotNodeFile + ' to D:')
Invoke-WebRequest -UseBasicParsing -Uri ($voiceBotNodeBase + '/' + $voiceBotNodeFile) -OutFile $voiceBotNodeArchive -TimeoutSec 180
$voiceBotActualHash = (Get-FileHash -LiteralPath $voiceBotNodeArchive -Algorithm SHA256).Hash
if ($voiceBotActualHash -ne $voiceBotExpectedHash) {
    throw 'SHA-256 mismatch. The downloaded archive has NOT been extracted or executed.'
}

Expand-Archive -LiteralPath $voiceBotNodeArchive -DestinationPath (Join-Path $env:VOICE_BOT_LOCAL 'tools')
$voiceBotActualVersion = (& (Join-Path $voiceBotNodeDestination 'node.exe') --version).Trim()
if ($LASTEXITCODE -ne 0 -or $voiceBotActualVersion -ne $Version) { throw 'Portable Node version validation failed.' }

$voiceBotReceipt = [ordered]@{
    version = $Version
    platform = 'win-x64'
    source = $voiceBotNodeBase + '/' + $voiceBotNodeFile
    manifest = $voiceBotNodeBase + '/SHASUMS256.txt'
    sha256 = $voiceBotActualHash
    verifiedAtUtc = [DateTime]::UtcNow.ToString('o')
    verification = 'SHA-256 matched manifest retrieved over official nodejs.org HTTPS; detached signature not verified.'
}
$voiceBotReceipt | ConvertTo-Json | Set-Content -LiteralPath $voiceBotNodeReceipt -Encoding UTF8
Write-Host ('Verified portable Node ' + $voiceBotActualVersion)
Write-Host ('SHA-256: ' + $voiceBotActualHash)
Write-Host 'Dot-source scripts\dev-env.ps1 again to activate the portable runtime.'
