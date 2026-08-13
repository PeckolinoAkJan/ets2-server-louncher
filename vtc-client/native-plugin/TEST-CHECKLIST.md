# Echte Ingame-Freigabe pro Spielversion

Eine Version darf nur in `compatibility.json` eingetragen werden, wenn alle Punkte auf einem separaten Testprofil bestanden wurden.

1. ETS2 beziehungsweise ATS startet mit dem Plugin ohne Warnung oder Absturz.
2. TAB öffnet und schließt den deutschen Dispatcher; die normale TAB-Funktion ist bei geschlossenem Overlay wieder verfügbar.
3. Falsches Spiel und falsches Kartenprofil werden abgewiesen.
4. Entfernung über 400 m setzt ausschließlich die Navigation zur Ausgangsfirma.
5. Gestellter Trailer: Auftrag wird an der richtigen Firma erzeugt, Trailer steht auf einem gültigen Abholplatz, Fracht/Trailer/Ziel stimmen.
6. Eigener Trailer: inkompatibler oder nicht angekoppelter Trailer wird abgewiesen; kompatibler Trailer erhält die Fracht ohne zweiten Trailer.
7. Auftrag lässt sich abschließen und Ergebnis wird gemeldet.
8. Spielneustart und Clientabbruch hinterlassen keinen halb aktiven Auftrag.
9. Profilbackup lässt sich wiederherstellen.
10. `uninstall-plugin.ps1` entfernt das Plugin beziehungsweise stellt die vorige Version wieder her.

Danach SHA256 des getesteten Builds ermitteln und `certify-version.ps1` mit allen vier Bestätigungsschaltern ausführen.
# Verbindlicher Multiplayer-Nachweis

- Der normale Start darf keinen Testspielstand anlegen oder automatisch laden und keine Maus-/Tastatureingaben an ETS2/ATS senden.
- Der Fahrer verwendet sein normales Profil und tritt über den offiziellen SCS-Convoy-Browser anhand der aktuellen Session Search ID bei.
- `verbunden` darf erst nach einer echten `[MP]`-Bestätigung im seit dem Start neu geschriebenen `game.log.txt` erscheinen.
- Ein VTC-Heartbeat, Telemetriedaten oder Einträge in `remote_players` dürfen allein niemals als Spielserververbindung gelten.
- Bei Zeitüberschreitung nennt der Launcher die nötige manuelle Convoy-Suche und zeigt keinen falschen verbundenen Zustand.
- Zwei Testrechner müssen zusätzlich im SCS-Convoy gegenseitig sichtbar sein; erst danach darf der Build als Multiplayer-geprüft gelten.
