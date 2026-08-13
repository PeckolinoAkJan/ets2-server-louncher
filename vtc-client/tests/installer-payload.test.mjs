import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Normaler Start richtet eine separate Savegame-Kopie ohne Eingabeautomation ein', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/release-launcher.yml', import.meta.url), 'utf8');
  assert.match(workflow, /native-plugin\/overlay-host\/\*/);
  assert.match(workflow, /dispatcher-core run build/);
  assert.match(workflow, /lib\/dispatcher-core/);
  assert.match(workflow, /vtc-client\/package\.json/);
  assert.match(workflow, /publish\/lib\/dispatcher-core\/index\.js/);
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(packageJson.type, 'module');
  const runtime = readFileSync(new URL('../launcher.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(runtime, /autoLoadDispatcherSlot/);
  assert.match(runtime, /load-test-slot\.ps1/);
  assert.match(runtime, /connection:'scs-convoy-manual'/);
  const shell = readFileSync(new URL('../../launcher-src/VtcTruckHub.Launcher/MainWindow.xaml.cs', import.meta.url), 'utf8');
  assert.match(shell, /state\.TestSave/);
  assert.match(shell, /separate Kopie deines neuesten ETS2-Autosaves/);
  assert.doesNotMatch(shell, /JoinMultiplayer\(game/);
  const view = readFileSync(new URL('../../launcher-src/VtcTruckHub.Launcher/MainWindow.xaml', import.meta.url), 'utf8');
  assert.match(view, /SCS Convoy/);
  assert.doesNotMatch(view, /eigener Multiplayer|VTC Native/);
  const loader = readFileSync(new URL('../native-plugin/overlay-host/load-test-slot.ps1', import.meta.url), 'utf8');
  assert.match(loader, /struct MOUSEINPUT/);
  assert.match(loader, /FieldOffset\(0\).*MOUSEINPUT/);
});
