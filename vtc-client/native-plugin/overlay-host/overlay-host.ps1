param([int]$Port = 27110)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows.Forms;
public static class VtcTabHook {
  public static event Action Toggle;
  static IntPtr hook=IntPtr.Zero; static LowLevelKeyboardProc callback=Hook;
  public static void Start(){using(var p=Process.GetCurrentProcess())using(var m=p.MainModule)hook=SetWindowsHookEx(13,callback,GetModuleHandle(m.ModuleName),0);}
  public static void Stop(){if(hook!=IntPtr.Zero)UnhookWindowsHookEx(hook);hook=IntPtr.Zero;}
  static bool IsTruckSimulatorForeground(){IntPtr window=GetForegroundWindow();if(window==IntPtr.Zero)return false;uint pid;GetWindowThreadProcessId(window,out pid);try{string name=Process.GetProcessById((int)pid).ProcessName.ToLowerInvariant();if(name=="eurotrucks2")return true;var title=new System.Text.StringBuilder(256);GetWindowText(window,title,title.Capacity);return title.ToString()=="VTC Truck Hub Dispatcher";}catch{return false;}}
  static IntPtr Hook(int code,IntPtr msg,IntPtr data){if(code>=0&&(msg==(IntPtr)0x100||msg==(IntPtr)0x104)){int key=Marshal.ReadInt32(data);if(key==(int)Keys.Tab&&IsTruckSimulatorForeground()){Toggle?.Invoke();return (IntPtr)1;}}return CallNextHookEx(hook,code,msg,data);}
  delegate IntPtr LowLevelKeyboardProc(int nCode,IntPtr wParam,IntPtr lParam);
  [DllImport("user32.dll")]static extern IntPtr SetWindowsHookEx(int id,LowLevelKeyboardProc cb,IntPtr module,uint thread);
  [DllImport("user32.dll")]static extern bool UnhookWindowsHookEx(IntPtr hook);
  [DllImport("user32.dll")]static extern IntPtr CallNextHookEx(IntPtr hook,int code,IntPtr msg,IntPtr data);
  [DllImport("kernel32.dll",CharSet=CharSet.Auto)]static extern IntPtr GetModuleHandle(string name);
  [DllImport("user32.dll")]static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr window,out uint processId);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern int GetWindowText(IntPtr window,System.Text.StringBuilder text,int maxCount);
}
'@

$form = New-Object Windows.Forms.Form
$form.Text = 'VTC Truck Hub Dispatcher'
$form.FormBorderStyle = 'None'
$form.StartPosition = 'Manual'
$form.TopMost = $true
$form.ShowInTaskbar = $false
$form.BackColor = [Drawing.Color]::FromArgb(7,18,27)
$form.Opacity = 0.97
$form.Size = New-Object Drawing.Size(1000,720)
$browser = New-Object Windows.Forms.WebBrowser
$browser.Dock = 'Fill'
$browser.ScriptErrorsSuppressed = $true
$browser.Url = "http://127.0.0.1:$Port/ingame.html"
$form.Controls.Add($browser)

function Position-Overlay {
  $game = Get-Process eurotrucks2,amtrucks -ErrorAction SilentlyContinue | Where-Object MainWindowHandle -ne 0 | Select-Object -First 1
  $area = if ($game) { [Windows.Forms.Screen]::FromHandle($game.MainWindowHandle).WorkingArea } else { [Windows.Forms.Screen]::PrimaryScreen.WorkingArea }
  $form.Left = $area.Left + [Math]::Max(0,($area.Width-$form.Width)/2)
  $form.Top = $area.Top + [Math]::Max(0,($area.Height-$form.Height)/2)
}

$toggle = [Action]{
  $form.BeginInvoke([Action]{
    if($form.Visible){$form.Hide()}else{Position-Overlay;$browser.Refresh();$form.Show();$form.Activate()}
  }) | Out-Null
}
[VtcTabHook]::add_Toggle($toggle)
[VtcTabHook]::Start()
$form.Add_Shown({$form.Hide()})
$form.Add_FormClosed({[VtcTabHook]::Stop()})
[Windows.Forms.Application]::Run($form)
