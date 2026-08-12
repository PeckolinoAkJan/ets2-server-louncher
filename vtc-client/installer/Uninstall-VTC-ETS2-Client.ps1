$ErrorActionPreference = 'Stop'
$ProductName = 'VTC Truck Hub ETS2 Client'
$InstallRoot = Join-Path $env:LOCALAPPDATA 'VTC Truck Hub\ETS2 Client'

Unregister-ScheduledTask -TaskName $ProductName -Confirm:$false -ErrorAction SilentlyContinue
Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$InstallRoot*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like '*VTC Truck Hub*overlay-host.ps1*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

$startMenu = Join-Path ([Environment]::GetFolderPath('Programs')) 'VTC Truck Hub'
$startupShortcut = Join-Path ([Environment]::GetFolderPath('Startup')) 'VTC Truck Hub ETS2 Client.lnk'
$desktopShortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) 'VTC Truck Hub ETS2 Client.lnk'
foreach ($item in @($startMenu, $startupShortcut, $desktopShortcut)) {
  if (Test-Path -LiteralPath $item) { Remove-Item -LiteralPath $item -Recurse -Force }
}
Remove-Item -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\VTCTruckHubETS2Client' -Recurse -Force -ErrorAction SilentlyContinue

# Remove only the client installation. ETS2 profiles and saves are outside this path.
$escaped = $InstallRoot.Replace("'", "''")
Start-Process powershell.exe -WindowStyle Hidden -ArgumentList '-NoProfile','-Command',"Start-Sleep -Seconds 2; if(Test-Path -LiteralPath '$escaped'){Remove-Item -LiteralPath '$escaped' -Recurse -Force}"
Write-Host "$ProductName wurde deinstalliert. ETS2-Spielstaende wurden nicht veraendert." -ForegroundColor Green
