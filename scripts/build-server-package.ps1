param([string]$Version = '1.5.0-ets2-test',[string]$ClientVersion = '0.5.0-test')
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Release = Join-Path $Root 'release'
$Stage = Join-Path $Release "ETS2-Server-Control-$Version"
if(Test-Path -LiteralPath $Stage){Remove-Item -LiteralPath $Stage -Recurse -Force}
New-Item -ItemType Directory -Path $Stage -Force|Out-Null

foreach($file in @('server.mjs','package.json','Dockerfile','docker-compose.yml','install.sh','Caddyfile.example','README.md')){
  Copy-Item -LiteralPath (Join-Path $Root $file) -Destination $Stage
}
Copy-Item -LiteralPath (Join-Path $Root 'public') -Destination $Stage -Recurse
Copy-Item -LiteralPath (Join-Path $Root 'scripts') -Destination $Stage -Recurse
Remove-Item -LiteralPath (Join-Path $Stage 'scripts\build-server-package.ps1') -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $Stage 'scripts\build-ets2-client-package.ps1') -Force -ErrorAction SilentlyContinue
$clientZip=Join-Path $Release "VTC-ETS2-Client-$ClientVersion.zip"
if(-not(Test-Path -LiteralPath $clientZip)){throw "Fahrerpaket fehlt: $clientZip"}
$downloads=Join-Path $Stage 'public\downloads';New-Item -ItemType Directory -Path $downloads -Force|Out-Null
$clientExe=Join-Path $Release "VTC-ETS2-Client-Setup-$ClientVersion.exe"
if(-not(Test-Path -LiteralPath $clientExe)){throw "Setup-EXE fehlt: $clientExe"}
$clientName='VTC-ETS2-Client-Setup.exe';Copy-Item -LiteralPath $clientExe -Destination (Join-Path $downloads $clientName) -Force
$clientHash=(Get-FileHash -LiteralPath $clientExe -Algorithm SHA256).Hash
[pscustomobject]@{product='VTC Truck Hub ETS2 Client';version=$ClientVersion;channel='closed-test';url="/downloads/$clientName";sha256=$clientHash;publishedAt=(Get-Date).ToUniversalTime().ToString('o')}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $downloads 'client-release.json') -Encoding UTF8

[pscustomobject]@{product='ETS2 Server Control';version=$Version;channel='closed-test';builtAt=(Get-Date).ToUniversalTime().ToString('o');containsSaveAdapter=$false;containsWindowsClient=$false} |
  ConvertTo-Json | Set-Content -LiteralPath (Join-Path $Stage 'release.json') -Encoding UTF8
$zip="$Stage.zip";if(Test-Path -LiteralPath $zip){Remove-Item -LiteralPath $zip -Force}
Compress-Archive -Path (Join-Path $Stage '*') -DestinationPath $zip -CompressionLevel Optimal
if(-not(Test-Path -LiteralPath $zip)){throw 'Das Server-ZIP wurde nicht erstellt.'}
Get-FileHash -LiteralPath $zip -Algorithm SHA256|Format-List
Write-Host "Serverpaket erstellt: $zip" -ForegroundColor Green
