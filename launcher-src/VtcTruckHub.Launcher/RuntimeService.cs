using System.Diagnostics;
using System.IO;
using System.Net.Http;

namespace VtcTruckHub.Launcher;

public sealed class RuntimeService
{
    private readonly string root = AppContext.BaseDirectory;

    public async Task EnsureStartedAsync()
    {
        if (await IsReadyAsync()) return;
        var node = Path.Combine(root, "runtime-node", "node.exe");
        var launcher = Path.Combine(root, "launcher.mjs");
        if (!File.Exists(node) || !File.Exists(launcher))
            throw new InvalidOperationException("Die lokale Launcher-Laufzeit ist unvollständig. Bitte den Installer erneut ausführen.");

        Process.Start(new ProcessStartInfo(node, $"\"{launcher}\"")
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

    private async Task<bool> IsReadyAsync()
    {
        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromMilliseconds(500) };
            return (await http.GetAsync("http://127.0.0.1:27110/api/status")).IsSuccessStatusCode;
        }
        catch { return false; }
    }

}
