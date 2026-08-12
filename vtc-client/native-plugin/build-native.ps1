param([Parameter(Mandatory=$true)][string]$ScsSdkInclude,[string]$BuildDir="$PSScriptRoot\build")
$ErrorActionPreference='Stop'
foreach($tool in 'cmake','msbuild'){if(-not(Get-Command $tool -ErrorAction SilentlyContinue)){throw "$tool wurde nicht gefunden. Visual Studio Build Tools mit C++ und CMake installieren."}}
if(-not(Test-Path (Join-Path $ScsSdkInclude 'scssdk_telemetry.h'))){throw 'Der Include-Ordner des offiziellen SCS Telemetry SDK ist ungültig.'}
cmake -S $PSScriptRoot -B $BuildDir -A x64 "-DSCS_SDK_INCLUDE=$ScsSdkInclude"
cmake --build $BuildDir --config Release
$dll=Join-Path $BuildDir 'Release\vtc_truck_hub.dll';if(-not(Test-Path $dll)){throw 'Plugin-Build wurde nicht erzeugt.'}
Write-Host "Build fertig: $dll";Get-FileHash $dll -Algorithm SHA256
