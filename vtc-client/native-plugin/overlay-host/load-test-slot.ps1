param(
  [ValidateRange(1,99)][int]$Slot = 3,
  [ValidateRange(250,5000)][int]$DelayMilliseconds = 900,
  [ValidateRange(10,180)][int]$ReadyTimeoutSeconds = 90,
  [string]$ResultFile = ''
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class VtcGameInput {
  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public InputUnion u; }
  [StructLayout(LayoutKind.Explicit)] public struct InputUnion { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
  [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public UIntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public UIntPtr dwExtraInfo; }
  [DllImport("user32.dll", SetLastError=true)] static extern uint SendInput(uint count, INPUT[] inputs, int size);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr handle);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr handle, int command);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr FindWindow(string className, string windowName);
  const uint KEYEVENTF_KEYUP=0x0002, KEYEVENTF_SCANCODE=0x0008;
  public static void Scan(ushort scan) {
    var events=new INPUT[2];
    events[0].type=1; events[0].u.ki.wScan=scan; events[0].u.ki.dwFlags=KEYEVENTF_SCANCODE;
    events[1].type=1; events[1].u.ki.wScan=scan; events[1].u.ki.dwFlags=KEYEVENTF_SCANCODE|KEYEVENTF_KEYUP;
    if(SendInput(2,events,Marshal.SizeOf(typeof(INPUT)))!=2) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
  }
}
'@
function Write-Result([string]$Status,[string]$Message) {
  if(-not $ResultFile){return}
  $parent=Split-Path -Parent $ResultFile
  if($parent){New-Item -ItemType Directory -Path $parent -Force|Out-Null}
  [pscustomobject]@{status=$Status;message=$Message;slot=$Slot;finishedAt=(Get-Date).ToUniversalTime().ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath $ResultFile -Encoding UTF8
}
try {
  $deadline=(Get-Date).AddSeconds($ReadyTimeoutSeconds)
  do {$game=Get-Process eurotrucks2 -ErrorAction SilentlyContinue|Where-Object {$_.MainWindowHandle -ne 0}|Select-Object -First 1;if(-not $game){Start-Sleep -Milliseconds 500}} while(-not $game -and (Get-Date)-lt $deadline)
  if(-not $game){throw 'Das ETS2-Fenster wurde nicht gefunden.'}
  $logFile=Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Euro Truck Simulator 2\game.log.txt'
  # game.log.txt is recreated for every ETS2 start. Search the complete current
  # session because loading a large mod set can push the profile marker beyond
  # a small tail window before the helper gets CPU time.
  do {$ready=(Test-Path -LiteralPath $logFile)-and[bool](Select-String -LiteralPath $logFile -Pattern 'New profile selected:|Set profile finished:' -Quiet -ErrorAction SilentlyContinue);if(-not $ready){Start-Sleep -Milliseconds 500}} while(-not $ready -and (Get-Date)-lt $deadline)
  if(-not $ready){throw 'Das ETS2-Profil wurde nicht rechtzeitig bereit.'}
  $overlay=[VtcGameInput]::FindWindow($null,'VTC Truck Hub Dispatcher');if($overlay-ne[IntPtr]::Zero){[VtcGameInput]::ShowWindowAsync($overlay,0)|Out-Null}
  [VtcGameInput]::ShowWindowAsync($game.MainWindowHandle,9)|Out-Null;[VtcGameInput]::SetForegroundWindow($game.MainWindowHandle)|Out-Null
  Start-Sleep -Milliseconds $DelayMilliseconds
  [VtcGameInput]::Scan(0x29);Start-Sleep -Milliseconds 400
  [Windows.Forms.SendKeys]::SendWait("game $Slot");[Windows.Forms.SendKeys]::SendWait('{ENTER}')
  $loadDeadline=(Get-Date).AddSeconds(45);$loaded=$false
  do {Start-Sleep -Milliseconds 500;$tail=Get-Content -LiteralPath $logFile -Tail 700 -ErrorAction SilentlyContinue;$loaded=[bool]($tail-match"Loading save\..*slot:\s*$Slot,.*?/save/$Slot/game\.sii")} while(-not $loaded -and (Get-Date)-lt $loadDeadline)
  if(-not $loaded){throw "ETS2 hat Testslot $Slot nicht bestätigt geladen."}
  # The SCS Search ID is intentionally not sent to Steam or the game console.
  # Convoy join is handled separately through the official server browser.
  Write-Result 'loaded' "ETS2-Testslot $Slot wurde geladen.";Write-Host "ETS2-Testslot $Slot wurde geladen." -ForegroundColor Green
} catch {Write-Result 'error' $_.Exception.Message;throw}
