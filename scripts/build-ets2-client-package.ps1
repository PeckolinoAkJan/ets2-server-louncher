param([string]$Version = '0.5.0-test')
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Source = Join-Path $Root 'vtc-client'
$Release = Join-Path $Root 'release'
$Stage = Join-Path $Release "VTC-ETS2-Client-$Version"
$Payload = Join-Path $Stage 'payload'
$Node = (Get-Command node.exe -ErrorAction Stop).Source

if (Test-Path -LiteralPath $Stage) { Remove-Item -LiteralPath $Stage -Recurse -Force }
New-Item -ItemType Directory -Path $Payload -Force | Out-Null

$files = @('launcher.mjs','launcher-window.ps1','package.json','config.example.json','start-client.cmd')
foreach ($file in $files) { Copy-Item -LiteralPath (Join-Path $Source $file) -Destination $Payload }
foreach ($folder in @('lib','ui','catalog','native-plugin')) {
  Copy-Item -LiteralPath (Join-Path $Source $folder) -Destination $Payload -Recurse
}
# Remove development, certification and save-test material from the driver package.
foreach ($relative in @('native-plugin\src','native-plugin\test-mode','native-plugin\build-native.ps1','native-plugin\certify-version.ps1','native-plugin\TEST-CHECKLIST.md')) {
  $target = Join-Path $Payload $relative
  if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
}
New-Item -ItemType Directory -Path (Join-Path $Payload 'runtime-node') -Force | Out-Null
Copy-Item -LiteralPath $Node -Destination (Join-Path $Payload 'runtime-node\node.exe')
New-Item -ItemType Directory -Path (Join-Path $Payload 'tools') -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $Source 'test-save\SII_Decrypt.exe') -Destination (Join-Path $Payload 'tools\SII_Decrypt.exe')
Copy-Item -LiteralPath (Join-Path $Source 'vendor\TS-SE-Tool\LICENSE') -Destination (Join-Path $Payload 'tools\THIRD-PARTY-LICENSES.txt')
Copy-Item -LiteralPath (Join-Path $Source 'installer\Install-VTC-ETS2-Client.ps1') -Destination $Stage
Copy-Item -LiteralPath (Join-Path $Source 'installer\INSTALLIEREN.cmd') -Destination $Stage
Copy-Item -LiteralPath (Join-Path $Source 'installer\Uninstall-VTC-ETS2-Client.ps1') -Destination (Join-Path $Payload 'Uninstall-VTC-ETS2-Client.ps1')

[pscustomobject]@{
  product='VTC Truck Hub ETS2 Client'; version=$Version; channel='closed-test'; game='ets2'
  builtAt=(Get-Date).ToUniversalTime().ToString('o'); localOnly=@('TAB overlay','save adapter'); server='https://ets-server.vtc-truck-hub.de'
} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $Stage 'release.json') -Encoding UTF8

$zip = "$Stage.zip"
if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }
Compress-Archive -Path (Join-Path $Stage '*') -DestinationPath $zip -CompressionLevel Optimal
if (-not (Test-Path -LiteralPath $zip)) { throw 'Das Client-ZIP wurde nicht erstellt.' }
Get-FileHash -LiteralPath $zip -Algorithm SHA256 | Format-List
Write-Host "Clientpaket erstellt: $zip" -ForegroundColor Green
