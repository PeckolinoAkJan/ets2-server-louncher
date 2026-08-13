import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('Launcher lädt den VTC-Slot ohne eine SCS-Such-ID als Steam-Lobby zu verwenden',()=>{
  const code=readFileSync(new URL('../launcher.mjs',import.meta.url),'utf8');
  const script=readFileSync(new URL('../native-plugin/overlay-host/load-test-slot.ps1',import.meta.url),'utf8');
  assert.match(code,/load-test-slot\.ps1/);
  assert.match(code,/load-status/);
  assert.match(code,/autoLoadDispatcherSlot\(input\.game,convoyJoin\.searchTerm\)/);
  assert.doesNotMatch(code,/'-LobbyId'/);
  assert.match(script,/SendWait\("game \$Slot"\)/);
  assert.match(script,/Loading save/);
  assert.match(script,/ui s convoy\.sessions/);
  assert.match(script,/ClickVirtual\(\$game\.MainWindowHandle,144,815\)/);
  assert.match(script,/ClickVirtual\(\$game\.MainWindowHandle,978,42\)/);
  assert.doesNotMatch(script,/connect_lobby/);
});

test('TAB wird nur in ETS2 oder dem Dispatcherfenster abgefangen',()=>{
  const script=readFileSync(new URL('../native-plugin/overlay-host/overlay-host.ps1',import.meta.url),'utf8');
  assert.match(script,/name=="eurotrucks2"/);
  assert.match(script,/VTC Truck Hub Dispatcher/);
  assert.doesNotMatch(script,/name=="powershell"/);
});
