param(
  [Parameter(Mandatory=$true)][ValidateSet('ets2','ats')][string]$Game,
  [Parameter(Mandatory=$true)][string]$DriverName,
  [Parameter(Mandatory=$true)][string]$SteamId,
  [Parameter(Mandatory=$true)][string]$Token,
  [string]$PanelUrl = 'https://ets-server.vtc-truck-hub.de',
  [string]$LocalTelemetryUrl = 'http://127.0.0.1:25555/api/ets2/telemetry'
)
$ErrorActionPreference = 'Stop'
$endpoint = "$($PanelUrl.TrimEnd('/'))/api/telemetry/$Game"
Write-Host "VTC Live-Telemetrie gestartet: $DriverName ($Game)"
while ($true) {
  try {
    $t = Invoke-RestMethod -Uri "$LocalTelemetryUrl?t=$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())" -TimeoutSec 3
    if ($t.game.connected) {
      $payload = @{
        name=$DriverName; steamId=$SteamId; ping=0
        city=if($t.job.sourceCity){$t.job.sourceCity}else{'Unterwegs'}
        company=if($t.job.sourceCompany){$t.job.sourceCompany}else{''}
        x=$t.truck.placement.x; y=$t.truck.placement.y; z=$t.truck.placement.z
        heading=$t.truck.placement.heading; speed=[math]::Abs($t.truck.speed)
      } | ConvertTo-Json -Compress
      Invoke-RestMethod -Method Post -Uri $endpoint -Headers @{Authorization="Bearer $Token"} -ContentType 'application/json' -Body $payload -TimeoutSec 5 | Out-Null
    }
  } catch { Write-Warning $_.Exception.Message }
  Start-Sleep -Seconds 2
}
