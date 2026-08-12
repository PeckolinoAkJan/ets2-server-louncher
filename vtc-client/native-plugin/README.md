# Native Ingame-Integration

Dieser Ordner ist die Sicherheitsgrenze für das spätere signierte ETS2/ATS-Plugin.

Geplante Aufgaben:

- konfigurierbare TAB-Taste abfangen und deutsche Oberfläche rendern,
- Spiel, Profil, DLCs, aktuellen LKW und eigenen Trailer erkennen,
- den lokal reservierten, serverseitig validierten Auftrag übernehmen,
- GPS-Ziel beziehungsweise Abholfirma setzen,
- einen gestellten Trailer auf einem gültigen Firmenplatz erzeugen oder den angekoppelten eigenen Trailer beladen,
- Auftragsergebnis an den Launcher melden.

Der offizielle SCS Telemetry SDK kann Fahrzeugdaten liefern, aber keine Aufträge oder Trailer erzeugen. Deshalb wird hier kein unsicherer Platzhalter ausgeliefert, der Spielstände verändert. Für jede unterstützte ETS2-/ATS-Version braucht das native Modul eine geprüfte, signierte Implementierung und Rückrollmöglichkeit.

Die Dispatcher-API schreibt den zuletzt validierten Auftrag nach `last-offer.json`. Das native Plugin darf nur signierte Aufträge übernehmen und muss vor jeder Änderung Profil und Spielversion prüfen.

## Vorhandene Werkzeuge

- `build-native.ps1`: baut das Grundplugin gegen den offiziellen SCS Telemetry SDK.
- `install-plugin.ps1`: installiert nur eine vorher zertifizierte Spielversion und legt Backups an.
- `uninstall-plugin.ps1`: entfernt das Plugin oder stellt die vorherige DLL wieder her.
- `certify-version.ps1`: trägt eine Version erst nach vier bestätigten Ingame-Tests ein.
- `TEST-CHECKLIST.md`: verbindliche Prüfung für TAB, gestellten Trailer, eigenen Trailer und Rollback.
- `overlay-host/overlay-host.ps1`: lokaler Windows-Overlay-Host; TAB wird nur abgefangen, wenn ETS2/ATS beziehungsweise das Overlay im Vordergrund ist.

## Noch erforderlicher versionsabhängiger Adapter

Der SCS SDK deckt Telemetrie und grundlegende Eingabegeräte ab, aber keine API zum Anlegen eines Frachtmarkt-Auftrags. Der ausführende Adapter für `create_freight_market_job` und `create_owned_trailer_job` muss deshalb für jede Spielversion separat entwickelt und mit der Checkliste getestet werden. Ohne zertifizierten Eintrag arbeitet der Installer absichtlich nicht.
