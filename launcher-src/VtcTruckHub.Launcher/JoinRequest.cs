namespace VtcTruckHub.Launcher;

public sealed record JoinRequest(string Game, string ServerId)
{
    public static bool TryParse(string? value, out JoinRequest? request)
    {
        request = null;
        if (value is null || !Uri.TryCreate(value, UriKind.Absolute, out _)) return false;
        var match = System.Text.RegularExpressions.Regex.Match(
            value,
            @"^vtctruckhub://join/(ets2|ats)/([A-Za-z0-9_-]{1,80})$",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase | System.Text.RegularExpressions.RegexOptions.CultureInvariant);
        if (!match.Success) return false;
        var game = match.Groups[1].Value.ToLowerInvariant();
        var serverId = match.Groups[2].Value;

        request = new JoinRequest(game, serverId);
        return true;
    }
}
