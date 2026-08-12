# Overlay Host

Der signierte Overlay-Host ist der Partner des nativen SCS-Plugins. Er wird vom Launcher gestartet und zeigt `http://127.0.0.1:27110/ingame.html` transparent über ETS2/ATS an.

Produktionsanforderungen:

- rahmenlos, transparent und nur sichtbar nach TAB,
- Mausaufnahme nur bei geöffnetem Dispatcher,
- Fokus wird beim Schließen an das Spiel zurückgegeben,
- Spielprozess und Fenster werden anhand der ausführbaren Datei erkannt,
- Overlay folgt Position und Größe des Spielfensters,
- keine Eingabeinjektion außer der konfigurierten Umschalttaste,
- Kommunikation ausschließlich mit dem lokalen Launcher,
- signierter Installer und automatische Updates,
- Abschaltung im Einzelspielermodus möglich.

Der lokale Prototyp ist bereits über `/ingame.html` testbar. Für die echte transparente Windows-Oberfläche wird ein signierter nativer Host beziehungsweise WebView2-Host gebaut. Ein gewöhnliches Browserfenster erfüllt die Ingame-Anforderung nicht und wird deshalb nicht als fertige Integration ausgegeben.
