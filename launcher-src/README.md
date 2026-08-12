# VTC Truck Hub Launcher

Nativer Windows-Launcher für ETS2 und ATS. Er zeigt keine localhost-Webseite und benötigt kein sichtbares PowerShell- oder Konsolenfenster. Die EXE startet die gebündelte lokale Node-Laufzeit selbst. Der TAB-Dispatcher ist direkt mit der modernen Microsoft-WebView2-Komponente in die native Anwendung integriert.

## Serverbeitritt

„Server beitreten“ startet ETS2 beziehungsweise ATS über `steam.exe -silent -applaunch` und übergibt den 64-Bit-Steam-Lobbyanteil der unmittelbar vorher vom Server geladenen SCS-Session-ID mit `+connect_lobby`. Das SCS-Suchsuffix (zum Beispiel `/101`) wird nicht an Steam übergeben. Dadurch erscheint kein zusätzlicher Steam-Dialog zur Bestätigung der Startparameter. Das Spiel lädt zunächst das vom Fahrer gewählte Profil. Beim anschließenden Klick auf „Spielen“ tritt es automatisch dem VTC-Server bei. Der Launcher meldet „verbunden“ ausschließlich nach `Game server joined` im neuen Abschnitt von `game.log.txt`.

## Release

Ein Tag wie `launcher-v0.9.5` startet GitHub Actions. Der Workflow testet Client und Server, baut eine selbstständige x64-EXE, bettet die lokale Node-Laufzeit ein, erzeugt den Installer und veröffentlicht SHA-256-Prüfsummen im GitHub Release.

## Updates

Der Launcher fragt die aktuelle Version über die GitHub-Release-API ab. Ein Update wird nur installiert, wenn der heruntergeladene Installer zur veröffentlichten SHA-256-Prüfsumme passt. Spielkompatibilität wird vor einem Release in Tests und einer Kompatibilitätsdatei gepflegt; ein neues SCS-Spielupdate wird nicht ungeprüft automatisch freigegeben.
