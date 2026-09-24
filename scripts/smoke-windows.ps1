param([string]$Executable = "$PSScriptRoot\..\node_modules\electron\dist\electron.exe", [switch]$Packaged)
$ErrorActionPreference = 'Stop'
$smokeDir = Join-Path $env:TEMP ('tyflow-visible-smoke-' + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $smokeDir | Out-Null
$env:STUDIO_SMOKE = '1'
$env:STUDIO_TEST_DATA = $smokeDir
try {
  $options = @{ FilePath = (Resolve-Path -LiteralPath $Executable).Path; WorkingDirectory = (Resolve-Path "$PSScriptRoot\..").Path; WindowStyle = 'Hidden'; PassThru = $true }
  if (-not $Packaged) { $options.ArgumentList = '.' }
  $client = Start-Process @options
  if (-not $client.WaitForExit(45000)) { Stop-Process -Id $client.Id; throw 'Client smoke timed out after 45 seconds' }
  $report = Get-Content -Raw -LiteralPath (Join-Path $smokeDir 'smoke.json') | ConvertFrom-Json
  if (-not $report.ready -or -not $report.bootstrapServed -or -not $report.visible -or $report.minimized) { throw "Window was not visible after launch: $($report | ConvertTo-Json -Compress)" }
  $report | ConvertTo-Json
  Write-Output "Evidence: $smokeDir"
} finally {
  Remove-Item Env:STUDIO_SMOKE,Env:STUDIO_TEST_DATA -ErrorAction SilentlyContinue
}
