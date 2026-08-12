param(
  [Parameter(Mandatory=$true)][ValidateSet('ets2','ats')][string]$Game,
  [Parameter(Mandatory=$true)][string]$GameVersion,
  [string]$DllPath = "$PSScriptRoot\build\Release\vtc_truck_hub.dll"
)
$ErrorActionPreference='Stop'
$compat=Get-Content "$PSScriptRoot\compatibility.json" -Raw | ConvertFrom-Json
$allowed=$compat.supported | Where-Object { $_.game -eq $Game -and $_.gameVersion -eq $GameVersion }
if(-not $allowed){throw "Spielversion $GameVersion für $Game ist noch nicht nach Ingame-Test freigegeben. Installation abgebrochen."}
if(-not (Test-Path -LiteralPath $DllPath)){throw "Gebautes und signiertes Plugin fehlt: $DllPath"}
$folder=if($Game -eq 'ets2'){'Euro Truck Simulator 2'}else{'American Truck Simulator'}
$roots=@("${env:ProgramFiles(x86)}\Steam\steamapps\common","${env:ProgramFiles}\Steam\steamapps\common")
$gameRoot=$roots | ForEach-Object { Join-Path $_ $folder } | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if(-not $gameRoot){throw "$folder wurde nicht gefunden."}
$pluginDir=Join-Path $gameRoot 'bin\win_x64\plugins';New-Item -ItemType Directory -Path $pluginDir -Force | Out-Null
$target=Join-Path $pluginDir 'vtc_truck_hub.dll';if(Test-Path $target){Copy-Item $target "$target.backup-$(Get-Date -Format yyyyMMddHHmmss)"}
Copy-Item -LiteralPath $DllPath -Destination $target -Force
$hash=(Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
Write-Host "Plugin installiert: $target";Write-Host "SHA256: $hash"
