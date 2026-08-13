# VTC Dispatcher Core

## Klassenstruktur

- `SiiParser`: tokenisiert das entschlüsselte SII-Format in ein typisiertes Dokument aus Units und Properties und serialisiert es wieder. Änderungen erfolgen am AST, nicht über Regex-Ersetzungen.
- `PointerGenerator`: sammelt alle vorhandenen Unit-IDs und erzeugt kollisionsfreie kryptografische `_nameless.xxxx.xxxx.xxxx`-IDs.
- `JobInjector`: validiert Firma, Ziel, Fracht und Trailer, berechnet `time_limit`, klont eine versionskompatible Jobvorlage und verknüpft sie mit dem `job_offer`-Array.
- `DispatcherService`: liest ausschließlich `game.sii`, prüft optional den vorherigen SHA256, erzeugt ein Backup und ersetzt die Datei atomisch.
- `electron-ipc`: validiert Renderer-Eingaben am Main-Prozess und stellt eine schmale, per `contextBridge` exportierbare API bereit.

Eine reale `company_job`-/`job_offer_data`-Unit wird als Vorlage benötigt. Dadurch bleiben unbekannte, versions- und DLC-abhängige Pflichtfelder erhalten. Die Anwendung muss geschlossen sein und die `game.sii` muss bereits entschlüsselt vorliegen.

## Electron-Anbindung

Im Main-Prozess:

```ts
import { ipcMain } from 'electron';
import { registerDispatcherIpc } from './dispatcher-core/src/electron-ipc.ts';

registerDispatcherIpc(ipcMain);
```

Im Preload-Skript (bei aktiviertem `contextIsolation`):

```ts
import { contextBridge, ipcRenderer } from 'electron';
import { createDispatcherRendererApi } from './dispatcher-core/src/electron-ipc.ts';

contextBridge.exposeInMainWorld('vtcDispatcher', createDispatcherRendererApi(ipcRenderer));
```

Der Renderer übergibt `gameSiiPath`, `sourceCompanyUnit`, `destinationCompanyUnit`, `cargo`, `trailerVariant`, `trailerDefinition` und `durationMinutes`. Direkter Dateisystemzugriff aus dem Renderer ist nicht nötig.

Beispiel im Renderer:

```ts
const result = await window.vtcDispatcher.injectJob({
  gameSiiPath: selectedSave,
  sourceCompanyUnit: 'company.volatile.lkwlog.hamburg',
  destinationCompanyUnit: 'company.volatile.eurogoodies.berlin',
  cargo: 'cargo.medical_equipment',
  trailerVariant: 'trailer_def.scs.box.single_3',
  trailerDefinition: 'trailer_def.scs.box',
  durationMinutes: 600,
  urgency: 1,
  expectedSha256: hashFromTheSelectionStep,
});
```

`expectedSha256` schützt vor Lost Updates: Wenn ETS2 oder eine andere Anwendung die Datei nach der Auswahl verändert hat, bricht der Service vor dem Schreiben ab. Das zurückgegebene Backup wird neben der `game.sii` abgelegt.
