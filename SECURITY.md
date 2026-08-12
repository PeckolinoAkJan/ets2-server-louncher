# Sicherheit und Rollen

- `admin`: Anmeldung ausschließlich am geschützten Webinterface. Darf Server, CFG, Pakete, Backups und Fahrerfreigaben verwalten.
- `driver`: Anmeldung ausschließlich über Launcher + Steam OpenID. Darf nur Serverlisten, Dispatcher und Telemetrie verwenden.
- Launcher-Tokens werden separat gespeichert, gehasht und niemals als Webinterface-Sitzung akzeptiert.
- Neue Fahrerregistrierungen erhalten zunächst den Status `pending`. Erst ein Administrator kann sie freigeben.
- Gesperrte oder entfernte Fahrer verlieren den Launcherzugriff; beim Entfernen werden vorhandene Launcher-Sitzungen widerrufen.
