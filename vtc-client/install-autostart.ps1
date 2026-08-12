$ErrorActionPreference = 'Stop'
$client = (Resolve-Path $PSScriptRoot).Path
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$client\start-client.cmd`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 0)
Register-ScheduledTask -TaskName 'VTC Truck Hub Client' -Action $action -Trigger $trigger -Settings $settings -Description 'Startet Launcher, Dispatcher und Telemetriebrücke automatisch.' -Force
Write-Host 'VTC Truck Hub Client wurde für den Windows-Autostart eingerichtet.'
