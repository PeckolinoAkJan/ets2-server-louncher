param(
  [ValidateRange(1,99)][int]$Slot = 3,
  [ValidatePattern('^\d{17,20}$')][string]$SearchTerm = '',
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
  [DllImport("user32.dll")] static extern bool GetClientRect(IntPtr handle, out RECT rect);
  [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr handle, ref POINT point);
  [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extraInfo);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc callback, IntPtr parameter);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr handle, out uint processId);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr handle);
  delegate bool EnumWindowsProc(IntPtr handle, IntPtr parameter);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int left, top, right, bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int x, y; }
  const uint KEYEVENTF_KEYUP=0x0002, KEYEVENTF_SCANCODE=0x0008;
  public static void Scan(ushort scan) {
    var events=new INPUT[2];
    events[0].type=1; events[0].u.ki.wScan=scan; events[0].u.ki.dwFlags=KEYEVENTF_SCANCODE;
    events[1].type=1; events[1].u.ki.wScan=scan; events[1].u.ki.dwFlags=KEYEVENTF_SCANCODE|KEYEVENTF_KEYUP;
    if(SendInput(2,events,Marshal.SizeOf(typeof(INPUT)))!=2) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
  }
  public static void ClickVirtual(IntPtr handle, double virtualX, double virtualY) {
    RECT rect; if(!GetClientRect(handle,out rect)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    POINT origin=new POINT(); if(!ClientToScreen(handle,ref origin)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    int x=origin.x+(int)Math.Round((virtualX/1440.0)*(rect.right-rect.left));
    int y=origin.y+(int)Math.Round((1.0-virtualY/900.0)*(rect.bottom-rect.top));
    if(!SetCursorPos(x,y)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    mouse_event(0x0002,0,0,0,UIntPtr.Zero); mouse_event(0x0004,0,0,0,UIntPtr.Zero);
  }
  public static IntPtr ProcessWindow(uint expectedProcessId) {
    IntPtr result=IntPtr.Zero;
    EnumWindows(delegate(IntPtr handle, IntPtr parameter) {
      uint processId; GetWindowThreadProcessId(handle,out processId);
      if(processId==expectedProcessId && IsWindowVisible(handle)) { result=handle; return false; }
      return true;
    },IntPtr.Zero);
    return result;
  }
}
'@
function Write-Result([string]$Status,[string]$Message) {
  if(-not $ResultFile){return}
  $parent=Split-Path -Parent $ResultFile
  if($parent){New-Item -ItemType Directory -Path $parent -Force|Out-Null}
  [pscustomobject]@{status=$Status;message=$Message;slot=$Slot;searchTerm=$SearchTerm;finishedAt=(Get-Date).ToUniversalTime().ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath $ResultFile -Encoding UTF8
}
try {
  $deadline=(Get-Date).AddSeconds($ReadyTimeoutSeconds)
  do {$game=Get-Process eurotrucks2 -ErrorAction SilentlyContinue|Select-Object -First 1;$gameHandle=if($game){[VtcGameInput]::ProcessWindow([uint32]$game.Id)}else{[IntPtr]::Zero};if($gameHandle-eq[IntPtr]::Zero){Start-Sleep -Milliseconds 500}} while($gameHandle-eq[IntPtr]::Zero -and (Get-Date)-lt $deadline)
  if($gameHandle-eq[IntPtr]::Zero){throw 'Das sichtbare ETS2-Fenster wurde nicht gefunden.'}
  $logFile=Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Euro Truck Simulator 2\game.log.txt'
  # game.log.txt is recreated for every ETS2 start. Search the complete current
  # session because loading a large mod set can push the profile marker beyond
  # a small tail window before the helper gets CPU time.
  do {$ready=(Test-Path -LiteralPath $logFile)-and[bool](Select-String -LiteralPath $logFile -Pattern 'New profile selected:|Set profile finished:' -Quiet -ErrorAction SilentlyContinue);if(-not $ready){Start-Sleep -Milliseconds 500}} while(-not $ready -and (Get-Date)-lt $deadline)
  if(-not $ready){throw 'Das ETS2-Profil wurde nicht rechtzeitig bereit.'}
  $overlay=[VtcGameInput]::FindWindow($null,'VTC Truck Hub Dispatcher');if($overlay-ne[IntPtr]::Zero){[VtcGameInput]::ShowWindowAsync($overlay,0)|Out-Null}
  [VtcGameInput]::ShowWindowAsync($gameHandle,9)|Out-Null;[VtcGameInput]::SetForegroundWindow($gameHandle)|Out-Null
  Start-Sleep -Milliseconds $DelayMilliseconds
  [VtcGameInput]::Scan(0x29);Start-Sleep -Milliseconds 400
  [Windows.Forms.SendKeys]::SendWait("game $Slot");[Windows.Forms.SendKeys]::SendWait('{ENTER}')
  $loadDeadline=(Get-Date).AddSeconds(45);$loaded=$false
  do {Start-Sleep -Milliseconds 500;$tail=Get-Content -LiteralPath $logFile -Tail 700 -ErrorAction SilentlyContinue;$loaded=[bool]($tail-match"Loading save\..*slot:\s*$Slot,.*?/save/$Slot/game\.sii")} while(-not $loaded -and (Get-Date)-lt $loadDeadline)
  if(-not $loaded){throw "ETS2 hat Testslot $Slot nicht bestätigt geladen."}
  if(-not $SearchTerm){Write-Result 'loaded' "ETS2-Testslot $Slot wurde geladen.";Write-Host "ETS2-Testslot $Slot wurde geladen." -ForegroundColor Green;exit 0}

  # Use the official SCS Convoy browser. The Search ID is not a Steam lobby ID.
  # Coordinates use SCS' 1440x900 virtual UI canvas and are scaled to the game
  # client area, so the adapter does not depend on a fixed desktop resolution.
  [VtcGameInput]::SetForegroundWindow($gameHandle)|Out-Null
  [VtcGameInput]::Scan(0x29);Start-Sleep -Milliseconds 350
  [Windows.Forms.SendKeys]::SendWait('ui s convoy.sessions');[Windows.Forms.SendKeys]::SendWait('{ENTER}');Start-Sleep -Seconds 2
  [VtcGameInput]::Scan(0x29);Start-Sleep -Seconds 2
  [VtcGameInput]::Scan(0x29);Start-Sleep -Milliseconds 350
  [Windows.Forms.SendKeys]::SendWait('screenshot vtc_convoy_browser');[Windows.Forms.SendKeys]::SendWait('{ENTER}');Start-Sleep -Seconds 2
  [VtcGameInput]::Scan(0x29)
  Write-Result 'browser_opened' "Der offizielle Convoy-Browser wurde zur sicheren Kalibrierung geoeffnet."
} catch {Write-Result 'error' $_.Exception.Message;throw}
