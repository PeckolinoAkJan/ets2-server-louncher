param([Parameter(Mandatory=$true)][ValidateSet('ets2','ats')][string]$Game)
$ErrorActionPreference='Stop';$folder=if($Game -eq 'ets2'){'Euro Truck Simulator 2'}else{'American Truck Simulator'}
$roots=@("${env:ProgramFiles(x86)}\Steam\steamapps\common","${env:ProgramFiles}\Steam\steamapps\common")
$plugin=$roots|ForEach-Object{Join-Path $_ "$folder\bin\win_x64\plugins\vtc_truck_hub.dll"}|Where-Object{Test-Path $_}|Select-Object -First 1
if(-not $plugin){Write-Host 'Kein installiertes VTC-Plugin gefunden.';exit 0}
$backup=Get-ChildItem "$plugin.backup-*" -ErrorAction SilentlyContinue|Sort-Object LastWriteTime -Descending|Select-Object -First 1
Remove-Item -LiteralPath $plugin -Force
if($backup){Move-Item -LiteralPath $backup.FullName -Destination $plugin;Write-Host "Vorherige Pluginversion wiederhergestellt: $plugin"}else{Write-Host 'VTC-Plugin entfernt.'}
