# Erster echter ETS2-Spieltest

Dieser Test verändert keinen normalen Spielstand. Er kopiert einen vorhandenen, gültigen ETS2-Spielstand als **VTC Dispatcher Test - Kiel nach Malmo** und sichert die Quelle zusätzlich im Projektordner.

## Testen

1. ETS2 vollständig schließen.
2. Beim ersten Mal `prepare-ets2-test.cmd`, danach `start-ets2-test.cmd` starten.
3. Im ETS2-Lademenü **VTC Dispatcher Test - Kiel nach Malmo** laden.
4. Prüfen: aktiver Auftrag Kiel → Malmö, Fracht Olivenbaum, gestellter Flachbett-Trailer.
5. Im Spiel `TAB` drücken: Der deutsche VTC-Dispatcher muss erscheinen; erneut `TAB` schließt ihn.

## Zurücksetzen

ETS2 schließen und `remove-ets2-test.cmd` starten. Es wird ausschließlich der Ordner `VTC_Dispatch_Test` entfernt. Die Sicherung unter `profile-backups` bleibt erhalten.

## Technische Grenze dieses Tests

Der Test bestätigt den kompletten lokalen Pfad aus Spielstand, realem Spielauftrag, Trailer und TAB-Overlay. Eine frei gewählte neue Tour aus dem Overlay wird erst nach der versionsgebundenen Job-Injektion aktiv. Die SCS-Telemetrie-API allein kann keine Frachten oder Trailer erzeugen.
