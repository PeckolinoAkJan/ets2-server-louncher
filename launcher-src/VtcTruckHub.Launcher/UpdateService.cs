using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text.Json;

namespace VtcTruckHub.Launcher;

public sealed record UpdateInfo(Version Version, string Tag, string PageUrl, string InstallerUrl, string? ChecksumsUrl);

public sealed class UpdateService
{
    const string ReleasesApi = "https://api.github.com/repos/PeckolinoAkJan/ets2-server-louncher/releases/latest";
    readonly HttpClient http = new() { Timeout = TimeSpan.FromSeconds(20) };

    public UpdateService()
    {
        http.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue("VTC-Truck-Hub-Launcher", CurrentVersion.ToString()));
        http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
    }

    public Version CurrentVersion => typeof(UpdateService).Assembly.GetName().Version ?? new Version(0, 0, 0);

    public async Task<UpdateInfo?> CheckAsync()
    {
        using var response = await http.GetAsync(ReleasesApi);
        if (!response.IsSuccessStatusCode) return null;
        using var json = JsonDocument.Parse(await response.Content.ReadAsStreamAsync());
        var root = json.RootElement;
        var tag = root.GetProperty("tag_name").GetString() ?? "";
        var versionText = tag.Replace("launcher-v", "", StringComparison.OrdinalIgnoreCase).TrimStart('v');
        if (!Version.TryParse(versionText, out var version) || version <= CurrentVersion) return null;
        var page = root.GetProperty("html_url").GetString() ?? "https://github.com/PeckolinoAkJan/ets2-server-louncher/releases";
        string? installer = null, checksums = null;
        foreach (var asset in root.GetProperty("assets").EnumerateArray())
        {
            var name = asset.GetProperty("name").GetString() ?? "";
            var url = asset.GetProperty("browser_download_url").GetString();
            if (name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) && name.Contains("Setup", StringComparison.OrdinalIgnoreCase)) installer = url;
            if (name.Equals("SHA256SUMS.txt", StringComparison.OrdinalIgnoreCase)) checksums = url;
        }
        return installer is null ? null : new UpdateInfo(version, tag, page, installer, checksums);
    }

    public async Task DownloadAndInstallAsync(UpdateInfo update)
    {
        var target = Path.Combine(Path.GetTempPath(), $"VTC-Truck-Hub-Launcher-Setup-{update.Version}.exe");
        await using (var output = File.Create(target))
        await using (var input = await http.GetStreamAsync(update.InstallerUrl))
            await input.CopyToAsync(output);

        if (update.ChecksumsUrl is not null)
        {
            var checksumText = await http.GetStringAsync(update.ChecksumsUrl);
            var fileName = Path.GetFileName(target);
            var expected = checksumText.Split('\n', StringSplitOptions.RemoveEmptyEntries)
                .Select(line => line.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries))
                .FirstOrDefault(parts => parts.Length >= 2 && parts[^1].Equals(fileName, StringComparison.OrdinalIgnoreCase))?.FirstOrDefault();
            var actual = Convert.ToHexString(await SHA256.HashDataAsync(File.OpenRead(target)));
            if (string.IsNullOrWhiteSpace(expected) || !actual.Equals(expected, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Die SHA-256-Prüfung des Updates ist fehlgeschlagen. Installation wurde abgebrochen.");
        }

        Process.Start(new ProcessStartInfo(target, "/SILENT /CLOSEAPPLICATIONS /RESTARTAPPLICATIONS") { UseShellExecute = true });
        System.Windows.Application.Current.Shutdown();
    }
}
