Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class VtcWindowCapture {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int command);
}
'@
$process = Get-Process powershell -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowTitle -eq 'VTC Truck Hub' } |
  Select-Object -First 1
if (-not $process) { throw 'Das Launcherfenster ist nicht geöffnet.' }
[VtcWindowCapture]::ShowWindow($process.MainWindowHandle, 9) | Out-Null
[VtcWindowCapture]::SetForegroundWindow($process.MainWindowHandle) | Out-Null
Start-Sleep -Milliseconds 600
$rect = New-Object VtcWindowCapture+RECT
if (-not [VtcWindowCapture]::GetWindowRect($process.MainWindowHandle, [ref]$rect)) { throw 'Fenstergröße konnte nicht gelesen werden.' }
$width = $rect.Right - $rect.Left
$height = $rect.Bottom - $rect.Top
$bitmap = New-Object System.Drawing.Bitmap $width, $height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bitmap.Size)
$output = Join-Path (Split-Path -Parent $PSScriptRoot) 'release\VTC-Launcher-Vorschau.png'
$bitmap.Save($output, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()
Write-Output $output
