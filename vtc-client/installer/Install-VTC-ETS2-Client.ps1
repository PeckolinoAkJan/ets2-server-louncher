param(
  [switch]$NoLaunch,
  [switch]$SkipAutostart,
  [switch]$NoDesktopShortcut,
  [string]$InstallRoot = ''
)
$ErrorActionPreference = 'Stop'

$ProductName = 'VTC Truck Hub ETS2 Client'
$ProductVersion = '0.6.0-test'
if (-not $InstallRoot) { $InstallRoot = Join-Path $env:LOCALAPPDATA 'VTC Truck Hub\ETS2 Client' }
$Payload = Join-Path $PSScriptRoot 'payload'
if (-not (Test-Path -LiteralPath (Join-Path $Payload 'launcher.mjs'))) {
  throw 'Das Installationspaket ist unvollstaendig (payload\launcher.mjs fehlt).'
}

# Stop only processes belonging to this client before updating its files.
Get-Process node -ErrorAction SilentlyContinue |
  Where-Object { $_.Path -like "$InstallRoot*" } |
  Stop-Process -Force -ErrorAction SilentlyContinue

New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null
$existingConfig = Join-Path $InstallRoot 'config.json'
$configBackup = $null
if (Test-Path -LiteralPath $existingConfig) {
  $configBackup = Join-Path $env:TEMP ('vtc-config-' + [guid]::NewGuid().ToString('N') + '.json')
  Copy-Item -LiteralPath $existingConfig -Destination $configBackup
}

Get-ChildItem -LiteralPath $Payload -Force | ForEach-Object {
  # node.exe can still be locked briefly by an earlier client instance. The
  # bundled runtime is immutable, so keep an existing copy during upgrades.
  if ($_.Name -eq 'runtime-node' -and (Test-Path -LiteralPath (Join-Path $InstallRoot 'runtime-node\node.exe'))) {
    return
  }
  Copy-Item -LiteralPath $_.FullName -Destination $InstallRoot -Recurse -Force
}
if ($configBackup) {
  Copy-Item -LiteralPath $configBackup -Destination $existingConfig -Force
  Remove-Item -LiteralPath $configBackup -Force
} elseif (-not (Test-Path -LiteralPath $existingConfig)) {
  Copy-Item -LiteralPath (Join-Path $InstallRoot 'config.example.json') -Destination $existingConfig
}

# Preserve user preferences while adding newly supported games and official VTC servers.
$installedConfig = Get-Content -LiteralPath $existingConfig -Raw | ConvertFrom-Json
$defaults = Get-Content -LiteralPath (Join-Path $InstallRoot 'config.example.json') -Raw | ConvertFrom-Json
$installedConfig.panelUrl = $defaults.panelUrl
$installedConfig.steamOpenIdReturnUrl = $defaults.steamOpenIdReturnUrl
$installedConfig.enabledGames = @('ets2','ats')
$installedConfig.servers = @($defaults.servers)
$installedConfig | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $existingConfig -Encoding UTF8

$launcher = Join-Path $InstallRoot 'start-client.cmd'
$uninstaller = Join-Path $InstallRoot 'Uninstall-VTC-ETS2-Client.ps1'
$shell = New-Object -ComObject WScript.Shell
$startMenu = Join-Path ([Environment]::GetFolderPath('Programs')) 'VTC Truck Hub'
New-Item -ItemType Directory -Path $startMenu -Force | Out-Null

$clientShortcut = $shell.CreateShortcut((Join-Path $startMenu 'VTC Truck Hub ETS2 Client.lnk'))
$clientShortcut.TargetPath = $launcher
$clientShortcut.WorkingDirectory = $InstallRoot
$clientShortcut.Description = 'VTC Truck Hub ETS2 Client und TAB-Dispatcher starten'
$clientShortcut.Save()

$removeShortcut = $shell.CreateShortcut((Join-Path $startMenu 'VTC Truck Hub ETS2 Client deinstallieren.lnk'))
$removeShortcut.TargetPath = 'powershell.exe'
$removeShortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$uninstaller`""
$removeShortcut.WorkingDirectory = $InstallRoot
$removeShortcut.Save()

if (-not $NoDesktopShortcut) {
  $desktopShortcut = $shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'VTC Truck Hub ETS2 Client.lnk'))
  $desktopShortcut.TargetPath = $launcher
  $desktopShortcut.WorkingDirectory = $InstallRoot
  $desktopShortcut.Description = 'VTC Truck Hub ETS2 Client und TAB-Dispatcher starten'
  $desktopShortcut.Save()
}

# Per-user Startup shortcut works without administrator rights.
$startupShortcutPath = Join-Path ([Environment]::GetFolderPath('Startup')) 'VTC Truck Hub ETS2 Client.lnk'
if (-not $SkipAutostart) {
  $startupShortcut = $shell.CreateShortcut($startupShortcutPath)
  $startupShortcut.TargetPath = $launcher
  $startupShortcut.WorkingDirectory = $InstallRoot
  $startupShortcut.WindowStyle = 7
  $startupShortcut.Save()
} elseif (Test-Path -LiteralPath $startupShortcutPath) {
  Remove-Item -LiteralPath $startupShortcutPath -Force
}

# Register a normal uninstall entry in Windows Settings > Apps.
$uninstallKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\VTCTruckHubETS2Client'
New-Item -Path $uninstallKey -Force | Out-Null
New-ItemProperty -Path $uninstallKey -Name DisplayName -Value $ProductName -PropertyType String -Force | Out-Null
New-ItemProperty -Path $uninstallKey -Name DisplayVersion -Value $ProductVersion -PropertyType String -Force | Out-Null
New-ItemProperty -Path $uninstallKey -Name Publisher -Value 'VTC Truck Hub' -PropertyType String -Force | Out-Null
New-ItemProperty -Path $uninstallKey -Name InstallLocation -Value $InstallRoot -PropertyType String -Force | Out-Null
New-ItemProperty -Path $uninstallKey -Name DisplayIcon -Value (Join-Path $InstallRoot 'runtime-node\node.exe') -PropertyType String -Force | Out-Null
New-ItemProperty -Path $uninstallKey -Name UninstallString -Value "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$uninstaller`"" -PropertyType String -Force | Out-Null
New-ItemProperty -Path $uninstallKey -Name NoModify -Value 1 -PropertyType DWord -Force | Out-Null
New-ItemProperty -Path $uninstallKey -Name NoRepair -Value 1 -PropertyType DWord -Force | Out-Null

Write-Host "$ProductName $ProductVersion wurde installiert: $InstallRoot" -ForegroundColor Green
if (-not $NoLaunch) {
  Start-Process -FilePath $env:ComSpec -ArgumentList '/c',("`"{0}`"" -f $launcher) -WindowStyle Hidden
}
