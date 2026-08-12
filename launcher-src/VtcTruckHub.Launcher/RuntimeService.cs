using System.Diagnostics;
using System.IO;
using System.Net.Http;

namespace VtcTruckHub.Launcher;

public sealed class RuntimeService : IDisposable
{
    private const string ExpectedRuntimeVersion = "0.9.1";
    private readonly string root = AppContext.BaseDirectory;
    private Process? serviceProcess;

    public async Task EnsureStartedAsync()
    {
        if (await IsReadyAsync()) return;
        var node = Path.Combine(root, "runtime-node", "node.exe");
        var launcher = Path.Combine(root, "launcher.mjs");
        if (!File.Exists(node) || !File.Exists(launcher))
            throw new InvalidOperationException("Die lokale Launcher-Laufzeit ist unvollständig. Bitte den Installer erneut ausführen.");

        serviceProcess = Process.Start(new ProcessStartInfo(node, $"\"{launcher}\"")
        {
            WorkingDirectory = root,
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden
        });

        for (var i = 0; i < 60; i++)
        {
            await Task.Delay(250);
            if (await IsReadyAsync()) return;
        }
        throw new InvalidOperationException("Der lokale VTC-Dienst konnte nicht gestartet werden.");
    }

    public void Dispose()
    {
        try
        {
            if (serviceProcess is { HasExited: false }) serviceProcess.Kill(entireProcessTree: true);
            serviceProcess?.Dispose();
        }
        catch { }
        serviceProcess = null;
        GC.SuppressFinalize(this);
    }

    private async Task<bool> IsReadyAsync()
    {
        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromMilliseconds(500) };
            var response = await http.GetAsync("http://127.0.0.1:27111/api/status");
            if (!response.IsSuccessStatusCode) return false;
            var body = await response.Content.ReadAsStringAsync();
            return body.Contains($"\"runtimeVersion\":\"{ExpectedRuntimeVersion}\"");
        }
        catch { return false; }
    }

}
