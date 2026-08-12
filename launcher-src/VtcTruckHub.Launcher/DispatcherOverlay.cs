using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;
using Microsoft.Web.WebView2.Wpf;

namespace VtcTruckHub.Launcher;

public sealed class DispatcherOverlay : Window, IDisposable
{
    readonly GlobalTabHook hook;
    readonly WebView2 browser = new();

    public DispatcherOverlay()
    {
        Title = "VTC Truck Hub Dispatcher";
        Width = 1000; Height = 720; Topmost = true; ShowInTaskbar = false;
        WindowStyle = WindowStyle.None; ResizeMode = ResizeMode.NoResize;
        Background = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(7, 18, 27));
        Content = browser;
        Loaded += async (_, _) =>
        {
            var userData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "VTC Truck Hub", "WebView2");
            Directory.CreateDirectory(userData);
            browser.CreationProperties = new CoreWebView2CreationProperties { UserDataFolder = userData };
            await browser.EnsureCoreWebView2Async();
            browser.CoreWebView2.Settings.AreDevToolsEnabled = false;
            browser.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            browser.Source = new Uri("http://127.0.0.1:27111/ingame.html");
        };
        hook = new GlobalTabHook(Toggle, IsSimulatorForeground);
    }

    void Toggle()
    {
        Dispatcher.BeginInvoke(() =>
        {
            if (IsVisible) { Hide(); return; }
            Left = SystemParameters.WorkArea.Left + Math.Max(0, (SystemParameters.WorkArea.Width - Width) / 2);
            Top = SystemParameters.WorkArea.Top + Math.Max(0, (SystemParameters.WorkArea.Height - Height) / 2);
            browser.CoreWebView2?.Reload(); Show(); Activate();
        });
    }

    bool IsSimulatorForeground()
    {
        var hwnd = GlobalTabHook.GetForegroundWindow();
        if (hwnd == IntPtr.Zero) return false;
        GetWindowThreadProcessId(hwnd, out var pid);
        try
        {
            var name = Process.GetProcessById((int)pid).ProcessName;
            return name.Equals("eurotrucks2", StringComparison.OrdinalIgnoreCase) || name.Equals("amtrucks", StringComparison.OrdinalIgnoreCase) || hwnd == new WindowInteropHelper(this).Handle;
        }
        catch { return false; }
    }

    public void Dispose()
    {
        hook.Dispose();
        browser.Dispose();
        Close();
        GC.SuppressFinalize(this);
    }
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}

public sealed class GlobalTabHook : IDisposable
{
    const int WhKeyboardLl = 13, WmKeyDown = 0x0100, WmSysKeyDown = 0x0104, VkTab = 0x09;
    readonly Action toggle; readonly Func<bool> active; readonly HookProc callback; IntPtr handle;

    public GlobalTabHook(Action toggle, Func<bool> active)
    {
        this.toggle = toggle; this.active = active; callback = Hook;
        handle = SetWindowsHookEx(WhKeyboardLl, callback, GetModuleHandle(null), 0);
        if (handle == IntPtr.Zero) throw new InvalidOperationException("TAB-Hotkey konnte nicht registriert werden.");
    }

    IntPtr Hook(int code, IntPtr message, IntPtr data)
    {
        if (code >= 0 && (message == (IntPtr)WmKeyDown || message == (IntPtr)WmSysKeyDown) && Marshal.ReadInt32(data) == VkTab && active()) { toggle(); return (IntPtr)1; }
        return CallNextHookEx(handle, code, message, data);
    }

    public void Dispose() { if (handle != IntPtr.Zero) UnhookWindowsHookEx(handle); handle = IntPtr.Zero; GC.SuppressFinalize(this); }
    public delegate IntPtr HookProc(int code, IntPtr message, IntPtr data);
    [DllImport("user32.dll")] static extern IntPtr SetWindowsHookEx(int id, HookProc proc, IntPtr module, uint threadId);
    [DllImport("user32.dll")] static extern bool UnhookWindowsHookEx(IntPtr hook);
    [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr message, IntPtr data);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern IntPtr GetModuleHandle(string? name);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
}
