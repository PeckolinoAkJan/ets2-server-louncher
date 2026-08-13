import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { DispatcherService } from '../src/dispatcher-service.ts';
import { SiiParser } from '../src/sii-parser.ts';
import { request, saveWithFreeSlot } from './fixture.ts';

test('DispatcherService schreibt atomisch, legt Backup an und prüft SHA256', () => {
  const directory = mkdtempSync(join(tmpdir(), 'vtc-dispatcher-'));
  const file = join(directory, 'game.sii');
  writeFileSync(file, saveWithFreeSlot, 'utf8');
  const expectedSha256 = createHash('sha256').update(readFileSync(file)).digest('hex');
  const result = new DispatcherService().injectFile({ ...request, gameSiiPath: file, expectedSha256 });
  assert.equal(result.ok, true);
  assert.equal(existsSync(result.backup), true);
  assert.equal(readFileSync(result.backup, 'utf8'), saveWithFreeSlot);
  assert.notEqual(result.beforeSha256, result.afterSha256);
  assert.ok(new SiiParser().parse(readFileSync(file, 'utf8')).units.find((unit) => unit.id === result.jobId));
  assert.throws(() => new DispatcherService().injectFile({ ...request, gameSiiPath: file, expectedSha256 }), /seit dem Einlesen verändert/);
});

test('DispatcherService lehnt verschlüsselte oder falsch benannte Dateien ab', () => {
  const directory = mkdtempSync(join(tmpdir(), 'vtc-dispatcher-'));
  const wrong = join(directory, 'save.sii');
  writeFileSync(wrong, saveWithFreeSlot);
  assert.throws(() => new DispatcherService().injectFile({ ...request, gameSiiPath: wrong }), /ausschließlich/);
  const encrypted = join(directory, 'game.sii');
  writeFileSync(encrypted, 'ScsC');
  assert.throws(() => new DispatcherService().injectFile({ ...request, gameSiiPath: encrypted }), /verschlüsselt/);
});

