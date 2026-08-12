import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('Launcher nutzt dokumentierten game-Slot-Lader und meldet das echte Ergebnis',()=>{const code=readFileSync(new URL('../launcher.mjs',import.meta.url),'utf8'),script=readFileSync(new URL('../native-plugin/overlay-host/load-test-slot.ps1',import.meta.url),'utf8');assert.match(code,/load-test-slot\.ps1/);assert.match(code,/load-status/);assert.match(script,/SendWait\("game \$Slot"\)/);assert.match(script,/SendInput/);assert.match(script,/Loading save/);});
test('TAB wird nur in ETS2 oder dem Dispatcherfenster abgefangen',()=>{const script=readFileSync(new URL('../native-plugin/overlay-host/overlay-host.ps1',import.meta.url),'utf8');assert.match(script,/name=="eurotrucks2"/);assert.match(script,/VTC Truck Hub Dispatcher/);assert.doesNotMatch(script,/name=="powershell"/);});
