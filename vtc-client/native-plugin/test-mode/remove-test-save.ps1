param([ValidateSet('ets2','ats')][string]$Game = 'ets2')
$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$ManifestPath = Join-Path $ProjectRoot 'active-test-save.json'
if (-not (Test-Path -LiteralPath $ManifestPath)) { Write-Host 'Kein aktiver VTC-Test-Spielstand registriert.' -ForegroundColor Yellow; exit 0 }
$Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
if ($Manifest.game -ne $Game) { throw "Registrierter Test gehört zu $($Manifest.game), nicht zu $Game." }
$Target = [IO.Path]::GetFullPath([string]$Manifest.target)
if (([IO.Path]::GetFileName($Target) -ne 'VTC_Dispatch_Test') -and ([IO.Path]::GetFileName($Target) -notmatch '^\d+$')) { throw "Unsicheres Löschziel abgelehnt: $Target" }
if (Get-Process -Name eurotrucks2,amtrucks -ErrorAction SilentlyContinue) { throw 'ETS2/ATS läuft noch. Bitte zuerst vollständig schließen.' }
if (Test-Path -LiteralPath $Target) { Remove-Item -LiteralPath $Target -Recurse -Force }
Remove-Item -LiteralPath $ManifestPath -Force
Write-Host "Test-Spielstand entfernt: $Target" -ForegroundColor Green
Write-Host "Die Sicherung bleibt erhalten: $($Manifest.backup)"
