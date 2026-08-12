# ETS2 Server Control

Ein selbst gehostetes, deutschsprachiges Webinterface für den offiziellen Euro Truck Simulator 2 Dedicated Server. Es orientiert sich an `webinterface.png` und führt echte Verwaltungsaktionen auf dem Host aus.

## Enthalten

- Sichere Ersteinrichtung und Admin-Login (scrypt, HttpOnly-Sitzung, CSRF-Schutz, Login-Drosselung)
- ETS2 Dedicated Server automatisch über SteamCMD installieren/aktualisieren (Steam App 1948160)
- Starten, Stoppen und Neustarten mit Prozessprüfung
- Status, CPU/RAM, Laufzeit und Such-ID aus Serverprotokollen
- ETS2 `server_config.sii` über Formulare verwalten
- `server_packages.sii` und `server_packages.dat` sicher hochladen
- Server-, Installations- und Audit-Protokolle
- Backups erstellen, herunterladen, wiederherstellen und löschen
- Responsive Oberfläche für Desktop und Mobilgeräte
- Docker-Compose-Paket und Reverse-Proxy-Beispiel

## Voraussetzungen

- Linux-Server (Ubuntu 24.04 LTS oder Debian 12/13 empfohlen)
- Docker Engine mit Docker Compose Plugin
- Eine Subdomain, die auf den Server zeigt
- HTTPS-Reverse-Proxy (Caddy, Nginx, Traefik oder Nginx Proxy Manager)
- UDP-Ports 27015 und 27016 in Firewall/Router freigegeben

## Installation

Den gesamten Ordner auf den Server kopieren, dann im Ordner einmal ausführen:

```bash
chmod +x install.sh
./install.sh
```

Danach die Subdomain per Reverse Proxy auf `127.0.0.1:3000` richten. Für Caddy kann `Caddyfile.example` angepasst werden. Beim ersten Öffnen wird das Administratorkonto angelegt. Anschließend im Dashboard **Jetzt installieren** anklicken.

Die Anwendung lauscht absichtlich nur lokal. Der Zugriff sollte ausschließlich über HTTPS erfolgen, weil die sichere Sitzung sonst nicht gesetzt wird. Für einen reinen lokalen Test kann in `docker-compose.yml` vorübergehend `COOKIE_SECURE: "false"` gesetzt werden.

## Benötigte ETS2-Paketdateien

Der Dedicated Server benötigt `server_packages.sii` und `server_packages.dat`. Diese werden auf einem Rechner mit ETS2 erzeugt:

1. Gewünschte Karte und Mod-Liste in ETS2 laden.
2. In `config.cfg` `uset g_console "1"` aktivieren.
3. Im Spiel die Konsole mit `~` öffnen.
4. `export_server_packages` eingeben.
5. Beide erzeugten Dateien im Menü **Server-Pakete** hochladen.

Die Dateien enthalten laut SCS keine Kontodaten. Die eigentlichen Moddateien müssen nicht auf den Dedicated Server kopiert werden.

## Betrieb

```bash
docker compose logs -f
docker compose restart
docker compose down
docker compose up -d --build
```

Persistente Daten liegen im Docker-Volume `ets2-control-data`. Dieses Volume bei einem Update niemals löschen. Mit `docker volume inspect ets2-control-data` lässt sich sein Speicherort anzeigen.

## Sicherheit

- Web-Port ist nur an `127.0.0.1` gebunden.
- Der Container läuft ohne Root-Rechte.
- Browser können keine freien Shell-Befehle ausführen; nur feste Verwaltungsaktionen sind erlaubt.
- Konfigurationsdateien und Benutzerkonten erhalten restriktive Dateirechte.
- Wiederherstellungen prüfen Archivpfade gegen Traversal.
- Kritische Aktionen werden protokolliert und teilweise bestätigt.

Für produktiven Betrieb sollte zusätzlich die Firewall nur für benötigte Ports geöffnet und Docker regelmäßig aktualisiert werden.

## Live-Karte und Spieler

Der offizielle ETS2 Dedicated Server stellt keine dokumentierte Web-API mit Live-Fahrzeugkoordinaten bereit. Die Oberfläche kennzeichnet diesen Bereich deshalb ehrlich als vorbereitet. Serverstatus und Verwaltung sind vollständig funktionsfähig; echte Kartenpositionen erfordern später eine separate kompatible Telemetriequelle.

## Quellen

- SCS Dedicated Server: https://modding.scssoft.com/wiki/Documentation/Tools/Dedicated_Server
- SCS Ankündigung: https://blog.scssoft.com/2022/12/convoy-dedicated-servers-support.html
