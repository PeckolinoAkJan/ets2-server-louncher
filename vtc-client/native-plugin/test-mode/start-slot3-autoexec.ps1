param([int]$Slot = 3, [int]$TimeoutSeconds = 120)
$ErrorActionPreference = 'Stop'
if ($Slot -lt 1 -or $Slot -gt 99) { throw 'Ungültiger Testslot' }
$gameExe = 'C:\Program Files (x86)\Steam\steamapps\common\Euro Truck Simulator 2\bin\win_x64\eurotrucks2.exe'
$gameRoot = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Euro Truck Simulator 2'
$autoexec = Join-Path $gameRoot 'autoexec.cfg'
$log = Join-Path $gameRoot 'game.log.txt'
$hadAutoexec = Test-Path -LiteralPath $autoexec
$original = if ($hadAutoexec) { [IO.File]::ReadAllBytes($autoexec) } else { $null }
$backup = Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\..\profile-backups')) ('autoexec-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.cfg')
if ($hadAutoexec) { [IO.File]::WriteAllBytes($backup,$original) }
try {
  $content = if ($hadAutoexec) { [Text.Encoding]::UTF8.GetString($original) + "`r`n" } else { '' }
  $content += "# Temporary VTC dispatcher test command`r`ngame $Slot`r`n"
  [IO.File]::WriteAllText($autoexec,$content,[Text.UTF8Encoding]::new($false))
  Get-Process eurotrucks2 -ErrorAction SilentlyContinue | Stop-Process -Force
  Start-Sleep -Milliseconds 600
  Start-Process -FilePath $gameExe | Out-Null
  $deadline=(Get-Date).AddSeconds($TimeoutSeconds);$loaded=$false
  do {
    Start-Sleep -Milliseconds 500
    if(Test-Path -LiteralPath $log){$loaded=((Get-Content -LiteralPath $log -Tail 500 -ErrorAction SilentlyContinue) -match "Loading save\. Type: 5, slot: $Slot,.*?/save/$Slot/game\.sii")}
  } while(-not $loaded -and (Get-Date)-lt $deadline)
  if(-not $loaded){throw "ETS2 hat Slot $Slot nicht innerhalb von $TimeoutSeconds Sekunden geladen"}
  Write-Host "ETS2 hat VTC-Testslot $Slot automatisch geladen." -ForegroundColor Green
} finally {
  if($hadAutoexec){[IO.File]::WriteAllBytes($autoexec,$original)}elseif(Test-Path -LiteralPath $autoexec){Remove-Item -LiteralPath $autoexec -Force}
}

