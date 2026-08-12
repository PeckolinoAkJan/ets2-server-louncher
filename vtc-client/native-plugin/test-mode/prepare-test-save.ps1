param(
  [ValidateSet('ets2','ats')][string]$Game = 'ets2',
  [string]$SourceSave = 'autosave_drive_3'
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$TestFolderName = 'VTC_Dispatch_Test'

if ($Game -eq 'ets2') {
  $GameName = 'Euro Truck Simulator 2'
  $ProcessName = 'eurotrucks2'
} else {
  $GameName = 'American Truck Simulator'
  $ProcessName = 'amtrucks'
}

if (Get-Process -Name $ProcessName -ErrorAction SilentlyContinue) {
  throw "$GameName läuft noch. Bitte das Spiel zuerst vollständig schließen."
}

$UserRoot = Join-Path ([Environment]::GetFolderPath('MyDocuments')) $GameName
$ProfileConfig = Join-Path $UserRoot 'config.cfg'
if (-not (Test-Path -LiteralPath $ProfileConfig)) { throw "$GameName-Benutzerordner wurde nicht gefunden: $UserRoot" }

$ProfileRoots = @(Join-Path $UserRoot 'profiles'; Join-Path $UserRoot 'steam_profiles') | Where-Object { Test-Path -LiteralPath $_ }
$Candidates = foreach ($profileRoot in $ProfileRoots) {
  Get-ChildItem -LiteralPath $profileRoot -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $saveRoot = Join-Path $_.FullName 'save'
    $source = Join-Path $saveRoot $SourceSave
    if (Test-Path -LiteralPath (Join-Path $source 'game.sii')) {
      [pscustomobject]@{ Profile = $_.FullName; SaveRoot = $saveRoot; Source = $source; Modified = (Get-Item -LiteralPath (Join-Path $source 'game.sii')).LastWriteTime }
    }
  }
}

$Selected = $Candidates | Sort-Object Modified -Descending | Select-Object -First 1
if (-not $Selected) { throw "Kein geeigneter Quell-Spielstand '$SourceSave' wurde gefunden." }
$Target = Join-Path $Selected.SaveRoot $TestFolderName
if (Test-Path -LiteralPath $Target) { throw "Der Test-Spielstand existiert bereits: $Target. Nutze zuerst remove-test-save.ps1." }

$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$BackupRoot = Join-Path $ProjectRoot "profile-backups\$Stamp"
New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
Copy-Item -LiteralPath $Selected.Source -Destination (Join-Path $BackupRoot $SourceSave) -Recurse
Copy-Item -LiteralPath $Selected.Source -Destination $Target -Recurse

$Decryptor = Join-Path $ProjectRoot 'test-save\SII_Decrypt.exe'
$TargetInfo = Join-Path $Target 'info.sii'
if ((Test-Path -LiteralPath $Decryptor) -and (Test-Path -LiteralPath $TargetInfo)) {
  & $Decryptor $TargetInfo | Out-Null
  $InfoText = [IO.File]::ReadAllText($TargetInfo)
  $InfoText = [Text.RegularExpressions.Regex]::Replace($InfoText, '(?m)^\s*name:\s*".*"\s*$', ' name: "VTC Dispatcher Test - Kiel nach Malmo"', 1)
  [IO.File]::WriteAllText($TargetInfo, $InfoText, [Text.UTF8Encoding]::new($false))
}

$Manifest = [ordered]@{
  createdAt = (Get-Date).ToString('o'); game = $Game; profile = $Selected.Profile
  source = $Selected.Source; target = $Target; backup = $BackupRoot
  testJob = [ordered]@{ source = 'Kiel'; destination = 'Malmo'; cargo = 'Olivenbaum'; trailer = 'Flachbett-Trailer'; mode = 'gestellter Trailer' }
}
$Manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $ProjectRoot 'active-test-save.json') -Encoding UTF8
Write-Host ''
Write-Host 'VTC-Test-Spielstand wurde sicher vorbereitet.' -ForegroundColor Green
Write-Host "Profil: $($Selected.Profile)"
Write-Host "Test-Spielstand: $Target"
Write-Host "Sicherung: $BackupRoot"
Write-Host 'Auftrag: Kiel -> Malmö | Olivenbaum | gestellter Flachbett-Trailer'
