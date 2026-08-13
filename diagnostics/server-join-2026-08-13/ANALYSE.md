# ETS2-Serverbeitritt – Diagnose vom 13.08.2026

## Ergebnis

Der Launcher startet ETS2 mit:

```text
+connect_lobby 85568392936581402
```

Die Nummer stammt aus der SCS-Session-Search-ID `85568392936581402/101` des Dedicated Servers. Eine Search-ID ist jedoch keine Steam-Lobby-ID. Der Steam-Parameter `+connect_lobby` erwartet eine echte 64-Bit-Steam-Lobby-ID. Daher startet das Spiel, tritt aber keinem SCS-Convoy bei.

## Nachweise

- Lokales `game.log.txt`: Kommandozeile enthält `+connect_lobby 85568392936581402`.
- Lokales `game.log.txt`: keine `[MP]`-Verbindungszeile nach dem Start.
- Das native Modul `vtc_truck_hub.dll` wird geladen und später sauber entladen. Der Pluginstart ist somit nicht die Ursache.
- Serverprotokoll: Session läuft mit Search-ID `85568392936581402/101`, Karte `/map/europe.mbd`, Spielversion `1.60s`, aktuell 0 Spieler.
- Steamworks dokumentiert `+connect_lobby` ausschließlich für Lobby-IDs.
- SCS dokumentiert die Search-ID als Suchbegriff für das Suchfeld des Ingame-Serverbrowsers.

## Belastbare Verbindungslösung

Der Launcher darf die Search-ID nicht mehr als Lobby-ID behandeln. Für den offiziellen SCS Dedicated Server muss der Client:

1. ETS2 über Steam starten.
2. Das richtige Profil laden.
3. Den offiziellen Convoy-/Serverbrowser öffnen.
4. Die vollständige Search-ID `85568392936581402/101` in dessen Suchfeld eingeben.
5. Den gefundenen Server auswählen und den Beitritt bestätigen.
6. Erst bei einer tatsächlichen `[MP] ... connected`-Zeile „verbunden“ melden.

Das lässt sich durch ein lokales, versionsgebundenes Ingame-UI-Modul automatisieren. Eine Webseite oder Datenbank kann den eigentlichen SCS-Netzwerkbeitritt nicht ersetzen.

## Dispatcher und Trailer

Der derzeitige Save-Adapter überschreibt nur ein vorhandenes `job_offer_data`. Er erzeugt keinen aktiven Auftrag und keinen gespawnten Trailer. Deshalb steht nach der Auswahl im VTC-Dispatcher noch kein Trailer an der Firma.

Für einen gestellten Trailer sind zwei sichere Wege möglich:

- den erzeugten Auftrag anschließend über die originale ETS2-Auftragsoberfläche aktivieren; ETS2 stellt dann den Trailer selbst bereit;
- oder den vollständigen aktiven Auftragszustand im getrennten VTC-Spielstand schreiben und den Spielstand neu laden. Das ist versionsabhängig und muss pro ETS2-Version geprüft werden.

Eigene Trailer benötigen einen Cargo-Market-Auftrag, der zum aktuell angehängten Trailer passt. Das ist ein anderer Datentyp als die derzeit bearbeiteten Freight-Market-Angebote.

## Zusätzliche Frachten

Alle Frachten, die bereits im Spiel, in DLCs oder in installierten Mods definiert sind, können aus dem Savegame beziehungsweise den geladenen Definitionen katalogisiert werden. Wirklich neue Frachten benötigen dagegen einen gemeinsamen ETS2-Mod auf jedem Client. Anschließend müssen `server_packages.sii` und `server_packages.dat` mit genau diesem Mod neu exportiert werden. Nur ein Datenbankeintrag erzeugt keine gültige ETS2-Fracht.

Der untersuchte VTC-Testspielstand enthält bereits 1.657 Firmeninstanzen, 5.512 Frachtangebote und 352 unterschiedliche Cargo-Definitionen. Der Ingame-Dispatcher zeigt momentan nur Vorlagen der jeweils gewählten Quellfirma. Die Daten fehlen also nicht; die Oberfläche filtert sie absichtlich stärker als gewünscht. Für eine vollständige Liste muss der Dispatcher alle mit der Quellfirma und dem Trailertyp kompatiblen Spiel-/DLC-/Mod-Frachten aggregieren und verständliche lokalisierte Namen anzeigen.

## Relevante Dokumentation

- SCS Dedicated Server: https://modding.scssoft.com/wiki/Documentation/Tools/Dedicated_Server
- Steam Matchmaking/Lobbys: https://partner.steamgames.com/doc/features/multiplayer/matchmaking
