using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Text.Json;

namespace VtcTruckHub.Launcher;

public sealed class RuntimeService : IDisposable
{
    private const string ExpectedRuntimeVersion = "0.9.10-dev";
    private readonly string root = AppContext.BaseDirectory;
    private Process? serviceProcess;

    public async Task EnsureStartedAsync()
    {
        if (await IsReadyAsync()) return;
        await StopIncompatibleRuntimeAsync();
        var node = Path.Combine(root, "runtime-node", "node.exe");
        var launcher = Path.Combine(root, "launcher.mjs");
        if (!File.Exists(node) || !File.Exists(launcher))
            throw new InvalidOperationException("Die lokale Launcher-Laufzeit ist unvollständig. Bitte den Installer erneut ausführen.");

        var diagnostics = new StringBuilder();
        var start = new ProcessStartInfo(node, $"\"{launcher}\"")
        {
            WorkingDirectory = root,
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden,
            RedirectStandardError = true,
            RedirectStandardOutput = true
        };
        serviceProcess = Process.Start(start);
        if (serviceProcess is null) throw new InvalidOperationException("Die lokale VTC-Laufzeit konnte nicht gestartet werden.");
        serviceProcess.OutputDataReceived += (_, e) => { if (e.Data is not null) diagnostics.AppendLine(e.Data); };
        serviceProcess.ErrorDataReceived += (_, e) => { if (e.Data is not null) diagnostics.AppendLine(e.Data); };
        serviceProcess.BeginOutputReadLine();
        serviceProcess.BeginErrorReadLine();

        for (var i = 0; i < 60; i++)
        {
            await Task.Delay(250);
            if (await IsReadyAsync()) return;
        }
        var detail = diagnostics.ToString().Trim();
        throw new InvalidOperationException("Der lokale VTC-Dienst konnte nicht gestartet werden." + (detail.Length == 0 ? "" : $"\n\nDiagnose:\n{detail}"));
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

    private async Task StopIncompatibleRuntimeAsync()
    {
        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
            var response = await http.GetAsync("http://127.0.0.1:27111/api/status");
            if (!response.IsSuccessStatusCode) return;
            var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            var version = json.RootElement.TryGetProperty("runtimeVersion", out var value) ? value.GetString() : null;
            if (version == ExpectedRuntimeVersion) return;
            await http.PostAsync("http://127.0.0.1:27111/api/runtime/shutdown", new StringContent("{}", Encoding.UTF8, "application/json"));
            for (var i = 0; i < 20; i++) { await Task.Delay(100); if (!await PortRespondsAsync()) return; }
        }
        catch { }
    }

    private static async Task<bool> PortRespondsAsync()
    {
        try { using var http = new HttpClient { Timeout = TimeSpan.FromMilliseconds(200) }; return (await http.GetAsync("http://127.0.0.1:27111/api/status")).IsSuccessStatusCode; }
        catch { return false; }
    }

}
