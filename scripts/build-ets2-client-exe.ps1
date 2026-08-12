param([string]$Version = '0.5.0-test')
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Release = Join-Path $Root 'release'
$Stage = Join-Path $Release "VTC-ETS2-Client-$Version"
$Exe = Join-Path $Release "VTC-ETS2-Client-Setup-$Version.exe"

& (Join-Path $PSScriptRoot 'build-ets2-client-package.ps1') -Version $Version
if (-not (Test-Path -LiteralPath (Join-Path $Stage 'Install-VTC-ETS2-Client.ps1'))) { throw 'Installerdateien fehlen.' }

$setupCmd = Join-Path $Stage 'SETUP.cmd'
@'
@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-VTC-ETS2-Client.ps1"
if errorlevel 1 (
  echo.
  echo Installation fehlgeschlagen. Bitte die Meldung fotografieren.
  pause
  exit /b 1
)
exit /b 0
'@ | Set-Content -LiteralPath $setupCmd -Encoding ASCII

$sed = Join-Path $env:TEMP ("vtc-iexpress-" + [guid]::NewGuid().ToString('N') + '.sed')
$stageEscaped = $Stage
$exeEscaped = $Exe
$payloadFiles = Get-ChildItem -LiteralPath $Stage -Recurse -File
$fileEntries = New-Object System.Collections.Generic.List[string]
$strings = New-Object System.Collections.Generic.List[string]
$index = 0
foreach ($file in $payloadFiles) {
  $key = "FILE$index"
  $relative = $file.FullName.Substring($Stage.Length + 1)
  $flat = $relative.Replace('\', '__')
  if ($relative -ne $flat) {
    Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $Stage $flat) -Force
  }
  $fileEntries.Add("$key=")
  $strings.Add("$key=$flat")
  $index++
}

# Re-enumerate only flat files for IExpress. The embedded setup reconstructs payload from a ZIP.
$innerZip = Join-Path $Stage 'client-payload.zip'
if (Test-Path -LiteralPath $innerZip) { Remove-Item -LiteralPath $innerZip -Force }
Compress-Archive -Path (Join-Path $Stage 'payload'),(Join-Path $Stage 'Install-VTC-ETS2-Client.ps1') -DestinationPath $innerZip -CompressionLevel Optimal
@'
@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '%~dp0client-payload.zip' -DestinationPath '%~dp0package' -Force; & '%~dp0package\Install-VTC-ETS2-Client.ps1'"
if errorlevel 1 (echo Installation fehlgeschlagen.& pause& exit /b 1)
exit /b 0
'@ | Set-Content -LiteralPath (Join-Path $Stage 'SETUP-EXE.cmd') -Encoding ASCII

$sedText = @"
[Version]
Class=IEXPRESS
SEDVersion=3
[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=0
HideExtractAnimation=1
UseLongFileName=1
InsideCompressed=0
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=N
InstallPrompt=
DisplayLicense=
FinishMessage=Der VTC Truck Hub ETS2 Client wurde installiert und gestartet.
TargetName=$exeEscaped
FriendlyName=VTC Truck Hub ETS2 Client Setup $Version
AppLaunched=SETUP-EXE.cmd
PostInstallCmd=<None>
AdminQuietInstCmd=
UserQuietInstCmd=SETUP-EXE.cmd
SourceFiles=SourceFiles
[SourceFiles]
SourceFiles0=$stageEscaped\
[SourceFiles0]
%FILE0%=
%FILE1%=
[Strings]
FILE0=SETUP-EXE.cmd
FILE1=client-payload.zip
"@
$sedText | Set-Content -LiteralPath $sed -Encoding ASCII
if (Test-Path -LiteralPath $Exe) { Remove-Item -LiteralPath $Exe -Force }
& "$env:WINDIR\System32\iexpress.exe" /N /Q $sed
$deadline = (Get-Date).AddSeconds(45)
while (-not (Test-Path -LiteralPath $Exe -PathType Leaf) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 500 }
if (-not (Test-Path -LiteralPath $Exe)) { throw 'Die Setup-EXE wurde nicht erstellt.' }
Start-Sleep -Seconds 3
Remove-Item -LiteralPath $sed -Force -ErrorAction SilentlyContinue
Get-FileHash -LiteralPath $Exe -Algorithm SHA256 | Format-List
Copy-Item -LiteralPath $Exe -Destination (Join-Path $Root 'public\downloads\VTC-ETS2-Client-Setup.exe') -Force
$hash = (Get-FileHash -LiteralPath $Exe -Algorithm SHA256).Hash
[pscustomobject]@{
  product='VTC Truck Hub ETS2 Client'; version=$Version; channel='closed-test'; format='exe'
  sha256=$hash; server='https://ets-server.vtc-truck-hub.de'; file='VTC-ETS2-Client-Setup.exe'
} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $Root 'public\downloads\client-release.json') -Encoding UTF8
Write-Host "Installer erstellt: $Exe" -ForegroundColor Green
