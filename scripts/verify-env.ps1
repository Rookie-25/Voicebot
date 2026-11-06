# Read-only verification, apart from directories created by dev-env.ps1.
# Use -Strict before future dependency installation/builds.
param([switch]$Strict)

. (Join-Path $PSScriptRoot 'dev-env.ps1')
$voiceBotChecks = [Collections.Generic.List[object]]::new()
function Add-VoiceBotCheck {
    param([string]$Name, [bool]$Passed, [string]$Detail)
    $voiceBotChecks.Add([pscustomobject]@{ Check = $Name; Passed = $Passed; Detail = $Detail })
}

foreach ($voiceBotDriveName in @('C', 'D')) {
    $voiceBotDrive = Get-PSDrive -Name $voiceBotDriveName
    # Some restricted PowerShell hosts omit PSDrive.Free. Keep the same safety
    # threshold, using the filesystem API rather than treating missing data as 0.
    $voiceBotFreeBytes = $voiceBotDrive.Free
    if ($null -eq $voiceBotFreeBytes) {
        $voiceBotFreeBytes = ([IO.DriveInfo]::new($voiceBotDriveName + ':\')).AvailableFreeSpace
    }
    $voiceBotMinimum = if ($voiceBotDriveName -eq 'C') { 2GB } else { 10GB }
    Add-VoiceBotCheck ($voiceBotDriveName + ': headroom') ($voiceBotFreeBytes -ge $voiceBotMinimum) (
        '{0:N2} GiB free; readiness threshold {1:N0} GiB' -f ($voiceBotFreeBytes / 1GB), ($voiceBotMinimum / 1GB)
    )
}

$voiceBotNodeCommand = Get-Command node.exe -ErrorAction Stop
$voiceBotNodeVersion = (& $voiceBotNodeCommand.Source --version).Trim()
$voiceBotNodeVersionOk = $voiceBotNodeVersion -match '^v24\.\d+\.\d+$'
$voiceBotNodeOnD = $voiceBotNodeCommand.Source.StartsWith((Join-Path $env:VOICE_BOT_LOCAL 'tools\'), [StringComparison]::OrdinalIgnoreCase)
Add-VoiceBotCheck 'Portable Node 24 LTS' ($voiceBotNodeVersionOk -and $voiceBotNodeOnD) ($voiceBotNodeVersion + ' at ' + $voiceBotNodeCommand.Source)

$voiceBotNpmCommand = Get-Command npm.cmd -ErrorAction Stop
$voiceBotNpmVersion = (& $voiceBotNpmCommand.Source --version | Out-String).Trim()
$voiceBotActualCache = (& $voiceBotNpmCommand.Source config get cache | Out-String).Trim()
Add-VoiceBotCheck 'npm cache on D:' ($voiceBotActualCache -eq $env:NPM_CONFIG_CACHE) ($voiceBotNpmVersion + '; cache=' + $voiceBotActualCache)
foreach ($voiceBotVariable in @('TEMP', 'TMP', 'NPM_CONFIG_PREFIX', 'NPM_CONFIG_USERCONFIG', 'NPM_CONFIG_LOGS_DIR', 'PLAYWRIGHT_BROWSERS_PATH', 'XDG_CACHE_HOME', 'WRANGLER_LOG_PATH')) {
    $voiceBotValue = [Environment]::GetEnvironmentVariable($voiceBotVariable, 'Process')
    Add-VoiceBotCheck $voiceBotVariable ($voiceBotValue.StartsWith($env:VOICE_BOT_LOCAL + '\', [StringComparison]::OrdinalIgnoreCase)) $voiceBotValue
}
foreach ($voiceBotToolName in @('git', 'codex')) {
    $voiceBotTool = Get-Command $voiceBotToolName -ErrorAction SilentlyContinue
    Add-VoiceBotCheck ($voiceBotToolName + ' available') ($null -ne $voiceBotTool) ([string]$voiceBotTool.Source)
}

$voiceBotChecks | Format-Table -AutoSize -Wrap
$voiceBotFailures = @($voiceBotChecks | Where-Object { -not $_.Passed })
if ($voiceBotFailures.Count) {
    Write-Warning 'NOT READY for dependency installation/builds. Resolve the failed checks first.'
    if ($Strict) { throw 'Milestone 0 readiness checks failed.' }
} else {
    Write-Host 'READY for Milestone 1 once separately authorized.'
}
