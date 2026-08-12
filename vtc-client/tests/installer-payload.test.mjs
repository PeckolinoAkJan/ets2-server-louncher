import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Installer bündelt den Slot-Lader für den echten Ein-Klick-Beitritt', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/release-launcher.yml', import.meta.url), 'utf8');
  assert.match(workflow, /native-plugin\/overlay-host\/\*/);
  const runtime = readFileSync(new URL('../launcher.mjs', import.meta.url), 'utf8');
  assert.match(runtime, /autoLoadDispatcherSlot/);
  assert.match(runtime, /load-test-slot\.ps1/);
});
