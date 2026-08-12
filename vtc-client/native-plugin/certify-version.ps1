param(
 [Parameter(Mandatory=$true)][ValidateSet('ets2','ats')][string]$Game,
 [Parameter(Mandatory=$true)][string]$GameVersion,
 [Parameter(Mandatory=$true)][string]$PluginSha256,
 [switch]$ProvidedTrailerPassed,[switch]$OwnedTrailerPassed,[switch]$TabOverlayPassed,[switch]$RollbackPassed
)
$ErrorActionPreference='Stop'
if(-not($ProvidedTrailerPassed -and $OwnedTrailerPassed -and $TabOverlayPassed -and $RollbackPassed)){throw 'Freigabe abgebrochen: Alle vier echten Ingame-Tests müssen bestätigt sein.'}
if($PluginSha256 -notmatch '^[A-Fa-f0-9]{64}$'){throw 'Ungültiger SHA256-Wert.'}
$file="$PSScriptRoot\compatibility.json";$data=Get-Content $file -Raw|ConvertFrom-Json
$entry=[pscustomobject]@{game=$Game;gameVersion=$GameVersion;pluginSha256=$PluginSha256.ToLower();certifiedAt=(Get-Date).ToUniversalTime().ToString('o');tests=@('tab_overlay','provided_trailer_at_company','owned_trailer_loading','rollback')}
$data.supported=@($data.supported|Where-Object{!($_.game-eq$Game-and$_.gameVersion-eq$GameVersion)})+$entry
$data|ConvertTo-Json -Depth 8|Set-Content $file -Encoding utf8
Write-Host "$Game $GameVersion wurde für diesen Plugin-Hash freigegeben."
