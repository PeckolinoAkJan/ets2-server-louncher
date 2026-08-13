using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows;
using Microsoft.Win32;

namespace VtcTruckHub.Launcher;

public partial class App : Application
{
    Mutex? instanceMutex;
    bool ownsInstanceMutex;
    static readonly string PendingUriFile = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "VTC Truck Hub", "Launcher", "pending-uri.txt");

    protected override void OnStartup(StartupEventArgs e)
    {
        instanceMutex = new Mutex(true, "Local\\VTC-Truck-Hub-Launcher", out var firstInstance);
        ownsInstanceMutex = firstInstance;
        if (!firstInstance)
        {
            SavePendingUri(e.Args);
            ActivateExistingWindow();
            Shutdown();
            return;
        }
        base.OnStartup(e);
        RegisterUriProtocol();
        var window = new MainWindow();
        MainWindow = window;
        window.Show();
        if (e.Args.FirstOrDefault() is { } initialUri) window.QueueJoinUri(initialUri);
        window.Activated += (_, _) => DeliverPendingUri(window);
    }

    protected override void OnExit(ExitEventArgs e)
    {
        if (ownsInstanceMutex)
        {
            instanceMutex?.ReleaseMutex();
        }
        instanceMutex?.Dispose();
        instanceMutex = null;
        ownsInstanceMutex = false;
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

    static void SavePendingUri(string[] args)
    {
        var uri = args.FirstOrDefault();
        if (!JoinRequest.TryParse(uri, out _)) return;
        Directory.CreateDirectory(Path.GetDirectoryName(PendingUriFile)!);
        File.WriteAllText(PendingUriFile, uri!);
    }

    static void DeliverPendingUri(MainWindow window)
    {
        try
        {
            if (!File.Exists(PendingUriFile)) return;
            var uri = File.ReadAllText(PendingUriFile).Trim();
            File.Delete(PendingUriFile);
            window.QueueJoinUri(uri);
        }
        catch { }
    }

    static void RegisterUriProtocol()
    {
        try
        {
            var executable = Environment.ProcessPath;
            if (string.IsNullOrWhiteSpace(executable)) return;
            using var protocol = Registry.CurrentUser.CreateSubKey(@"Software\Classes\vtctruckhub");
            protocol.SetValue(null, "URL:VTC Truck Hub");
            protocol.SetValue("URL Protocol", "");
            using var icon = protocol.CreateSubKey("DefaultIcon");
            icon.SetValue(null, $"{executable},0");
            using var command = protocol.CreateSubKey(@"shell\open\command");
            command.SetValue(null, $"\"{executable}\" \"%1\"");
        }
        catch { }
    }

    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr handle);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr handle, int command);
}
