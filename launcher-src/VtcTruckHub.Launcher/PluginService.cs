using System.IO;

namespace VtcTruckHub.Launcher;

public sealed class PluginService
{
    readonly string bundledPlugin = Path.Combine(AppContext.BaseDirectory, "native-plugin", "vtc_truck_hub.dll");

    public string EnsureInstalled(GameInfo game)
    {
        if (!File.Exists(bundledPlugin))
            throw new InvalidOperationException("Das native VTC-Spielmodul fehlt im Launcher. Bitte den aktuellen Installer erneut ausführen.");
        if (string.IsNullOrWhiteSpace(game.Executable) || !File.Exists(game.Executable))
            throw new InvalidOperationException($"Die {game.Id.ToUpperInvariant()}-Installation wurde nicht gefunden.");

        var binaryDirectory = Path.GetDirectoryName(game.Executable)!;
        var pluginDirectory = Path.Combine(binaryDirectory, "plugins");
        Directory.CreateDirectory(pluginDirectory);
        var target = Path.Combine(pluginDirectory, "vtc_truck_hub.dll");
        if (!File.Exists(target) || !SameFile(bundledPlugin, target)) File.Copy(bundledPlugin, target, true);
        return target;
    }

    static bool SameFile(string left, string right)
    {
        var a = new FileInfo(left); var b = new FileInfo(right);
        if (a.Length != b.Length) return false;
        using var x = File.OpenRead(left); using var y = File.OpenRead(right);
        using var hx = System.Security.Cryptography.SHA256.Create();
        using var hy = System.Security.Cryptography.SHA256.Create();
        return hx.ComputeHash(x).SequenceEqual(hy.ComputeHash(y));
    }
}
