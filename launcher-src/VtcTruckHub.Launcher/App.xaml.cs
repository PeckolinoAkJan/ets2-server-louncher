using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows;

namespace VtcTruckHub.Launcher;

public partial class App : Application
{
    Mutex? instanceMutex;

    protected override void OnStartup(StartupEventArgs e)
    {
        instanceMutex = new Mutex(true, "Local\\VTC-Truck-Hub-Launcher", out var firstInstance);
        if (!firstInstance)
        {
            ActivateExistingWindow();
            Shutdown();
            return;
        }
        base.OnStartup(e);
    }

    protected override void OnExit(ExitEventArgs e)
    {
        instanceMutex?.ReleaseMutex();
        instanceMutex?.Dispose();
        instanceMutex = null;
        base.OnExit(e);
    }

    static void ActivateExistingWindow()
    {
        var current = Environment.ProcessId;
        foreach (var process in Process.GetProcessesByName("VTC-Truck-Hub-Launcher"))
        {
            if (process.Id == current || process.MainWindowHandle == IntPtr.Zero) continue;
            ShowWindow(process.MainWindowHandle, 9);
            SetForegroundWindow(process.MainWindowHandle);
            break;
        }
    }

    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr handle);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr handle, int command);
}
