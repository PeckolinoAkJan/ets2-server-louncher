# VTC Truck Hub Client – Entwicklungsbasis

Dieser Unterordner enthält die erste lauffähige Basis für den geplanten eigenen ETS2-/ATS-Client:

- deutscher Launcher und Dispatcher im lokalen Browser,
- automatische Erkennung installierter ETS2-/ATS-Spiele,
- vorbereitete Steam-OpenID-Anmeldung plus zwingende VTC-Kontoverknüpfung,
- getrennte Kataloge für ETS2/ATS, Standardkarte und ProMods,
- ausschließlich serverseitig geprüfte realistische Firmen-/Fracht-/Trailerkombinationen,
- gestellter Trailer oder eigener Trailer als Dispatcher-Modus,
- lokaler Auftragspuffer für die spätere native Ingame-Integration,
- Telemetriedienst als gemeinsam startbare Clientkomponente,
- Windows-Autostartskript.

## Lokal starten

Node.js 22 oder neuer installieren und `start-client.cmd` ausführen. Alternativ:

```powershell
node launcher.mjs
```

Danach `http://127.0.0.1:27110` öffnen.

`config.example.json` nach `config.json` kopieren, um Einstellungen lokal zu ändern. Geheimnisse oder Steam-Passwörter dürfen dort nicht gespeichert werden.

## Steam und VTC

Der Launcher erzeugt einen Steam-OpenID-Loginlink. Der Callback und die dauerhafte Verknüpfung müssen anschließend im produktiven Webinterface implementiert werden. Das lokale Testkonto ist ausschließlich für die Entwicklung gedacht und wird vor einer Veröffentlichung entfernt.

## Standardkarte und ProMods

Die JSON-Dateien unter `catalog/` sind ein erweiterbares, getrenntes Katalogschema. Die enthaltenen Datensätze sind ein funktionsfähiger Beispielsatz, kein vollständiger Extrakt aller Spiel- und ProMods-Daten. Vor dem Produktivbetrieb werden die IDs für jede unterstützte Spiel-/Modversion aus freigegebenen Katalogpaketen importiert und signiert.

## Trailer im Spiel

Die realistische Auswahl, Reservierung, lokale Ingame-Ansicht und der vollständige Auftrags-Zustandsautomat funktionieren. Er unterscheidet:

- Navigation zur Ausgangsfirma,
- Ankunft innerhalb von 400 Metern,
- gestellten Trailer am Firmenplatz erzeugen,
- eigenen Trailer verlangen und Kompatibilität prüfen,
- Auftrag aktivieren, abschließen oder sicher fehlschlagen lassen.

Die Befehle `create_freight_market_job` und `create_owned_trailer_job` sind als streng typisierte lokale Integrationsbefehle vorhanden. Das tatsächliche Ausführen im Spiel benötigt das versionsabhängige native Clientmodul. Details stehen in `native-plugin/README.md` und `native-plugin/protocol.schema.json`.

`ui/ingame.html` ist der deutsche Ingame-Dispatcher für den späteren transparenten Overlay-Host.

## Telemetrie-Autostart

Die Klasse `lib/telemetry-service.mjs` verbindet eine lokale SCS-kompatible Telemetriequelle mit dem bestehenden Panel. `install-autostart.ps1` startet den gesamten Client bei der Windows-Anmeldung. Die eigentliche native Telemetriequelle wird später zusammen mit dem signierten Plugin installiert; bis dahin kann die bestehende lokale Funbit-kompatible Schnittstelle verwendet werden.

## Versionsfreigabe

`native-plugin/compatibility.json` arbeitet absichtlich nach dem Prinzip *fail closed*. Eine ETS2-/ATS-Version wird dort erst nach echtem Ingame-Test eingetragen. Ohne freigegebene Version darf das Plugin weder Aufträge noch Profile verändern. Damit verhindern Updates des Spiels, dass ein veraltetes Plugin Spielstände beschädigt.
