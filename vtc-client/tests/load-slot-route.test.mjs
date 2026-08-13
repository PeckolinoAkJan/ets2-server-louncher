import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('Launcher lädt den VTC-Slot ohne eine SCS-Such-ID als Steam-Lobby zu verwenden',()=>{
  const code=readFileSync(new URL('../launcher.mjs',import.meta.url),'utf8');
  const script=readFileSync(new URL('../native-plugin/overlay-host/load-test-slot.ps1',import.meta.url),'utf8');
  assert.match(code,/load-test-slot\.ps1/);
  assert.match(code,/load-status/);
  assert.doesNotMatch(code,/autoLoadDispatcherSlot/);
  assert.doesNotMatch(code,/'-LobbyId'/);
  assert.match(script,/SendWait\("game \$Slot"\)/);
  assert.match(script,/Loading save/);
  assert.match(script,/ui s convoy\.sessions/);
  assert.match(script,/screenshot vtc_convoy_browser/);
  assert.match(script,/ProcessWindow\(\[uint32\]\$game\.Id\)/);
  for(const stage of ['waiting_window','window_found','profile_ready','slot_loaded','opening_console','browser_command_sent','browser_opened','screenshot_requested'])assert.match(script,new RegExp(`Write-Result '${stage}'`));
  assert.doesNotMatch(script,/ClickVirtual\(\$game\.MainWindowHandle,978,42\)/);
  assert.doesNotMatch(script,/connect_lobby/);
});

test('TAB wird nur in ETS2 oder dem Dispatcherfenster abgefangen',()=>{
  const script=readFileSync(new URL('../native-plugin/overlay-host/overlay-host.ps1',import.meta.url),'utf8');
  assert.match(script,/name=="eurotrucks2"/);
  assert.match(script,/VTC Truck Hub Dispatcher/);
  assert.doesNotMatch(script,/name=="powershell"/);
});
