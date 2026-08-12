# VTC Live-Telemetrie

Der Client verbindet die lokale Funbit-Telemetrie (`127.0.0.1:25555`) sicher mit dem VTC-Webinterface.

1. Funbit ETS2/ATS Telemetry Web Server installieren und starten.
2. Im Webinterface unter **Einstellungen → Live-Telemetrie** den Token kopieren.
3. PowerShell starten:

```powershell
.\VTC-Telemetry-Bridge.ps1 -Game ets2 -DriverName "RoadKing" -SteamId "76561198000000000" -Token "TOKEN"
```

Für ATS `-Game ats` verwenden. Der Token ist ein Geheimnis und darf nicht veröffentlicht werden.
