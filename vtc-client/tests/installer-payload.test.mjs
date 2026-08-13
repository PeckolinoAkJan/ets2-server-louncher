import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Normaler Start verwendet keine Testslot- oder Eingabeautomation', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/release-launcher.yml', import.meta.url), 'utf8');
  assert.match(workflow, /native-plugin\/overlay-host\/\*/);
  const runtime = readFileSync(new URL('../launcher.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(runtime, /autoLoadDispatcherSlot/);
  assert.match(runtime, /load-test-slot\.ps1/);
  assert.match(runtime, /connection:'scs-convoy-manual'/);
  const shell = readFileSync(new URL('../../launcher-src/VtcTruckHub.Launcher/MainWindow.xaml.cs', import.meta.url), 'utf8');
  assert.doesNotMatch(shell, /state\.TestSave/);
  assert.doesNotMatch(shell, /JoinMultiplayer\(game/);
  const view = readFileSync(new URL('../../launcher-src/VtcTruckHub.Launcher/MainWindow.xaml', import.meta.url), 'utf8');
  assert.match(view, /SCS Convoy/);
  assert.doesNotMatch(view, /eigener Multiplayer|VTC Native/);
  const loader = readFileSync(new URL('../native-plugin/overlay-host/load-test-slot.ps1', import.meta.url), 'utf8');
  assert.match(loader, /struct MOUSEINPUT/);
  assert.match(loader, /FieldOffset\(0\).*MOUSEINPUT/);
});
