import test from 'node:test';
import assert from 'node:assert/strict';
import { JobInjector, SiiParser } from '../../vtc-client/lib/dispatcher-core/index.js';
import { request, saveWithFreeSlot } from './fixture.ts';

const property = (unit: any, key: string) => unit.properties.find((item: any) => item.key === key && item.index === null)?.value.raw;

test('JobInjector erzeugt vollständigen company_job im freien null-Slot', () => {
  const parser = new SiiParser();
  const result = new JobInjector().inject(parser.parse(saveWithFreeSlot), request);
  assert.match(result.jobId, /^_nameless\.[0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4}$/);
  assert.equal(result.slot, 1);
  assert.equal(result.replacedJobId, null);
  assert.equal(result.timeLimit, 12600);
  const job = result.document.units.find((unit) => unit.id === result.jobId)!;
  assert.equal(job.unitType, 'company_job');
  assert.equal(property(job, 'target'), '"eurogoodies.berlin"');
  assert.equal(property(job, 'time_limit'), '12600');
  assert.equal(property(job, 'expiration_time'), '12600');
  assert.equal(property(job, 'cargo'), request.cargo);
  assert.equal(property(job, 'trailer_variant'), request.trailerVariant);
  assert.equal(property(job, 'trailer_definition'), request.trailerDefinition);
  assert.equal(property(job, 'unknown_version_field'), '(1, 2, 3)');
  assert.doesNotThrow(() => parser.parse(parser.serialize(result.document)));
});

test('volles Array überschreibt deterministisch den unwichtigsten frühesten Job', () => {
  const parser = new SiiParser();
  const full = saveWithFreeSlot.replace('job_offer[1]: null', 'job_offer[1]: _nameless.7777.8888.9999').replace('\ncompany : company.volatile.eurogoodies.berlin', `
company_job : _nameless.7777.8888.9999 {
 target: "eurogoodies.berlin"
 time_limit: 11900
 cargo: cargo.old
 trailer_variant: trailer.old
 trailer_definition: trailer_def.old
}
company : company.volatile.eurogoodies.berlin`);
  const result = new JobInjector().inject(parser.parse(full), request);
  assert.equal(result.slot, 1);
  assert.equal(result.replacedJobId, '_nameless.7777.8888.9999');
  assert.equal(result.document.units.some((unit) => unit.id === '_nameless.7777.8888.9999'), false);
});

test('ungültige Firmen, Tokens und Zeiten werden vor einer Änderung abgewiesen', () => {
  const injector = new JobInjector(), document = new SiiParser().parse(saveWithFreeSlot);
  assert.throws(() => injector.inject(document, { ...request, sourceCompanyUnit: 'hamburg' }), /Quellfirma/);
  assert.throws(() => injector.inject(document, { ...request, cargo: 'cargo.bad\nmalicious: true' }), /ungültige Zeichen/);
  assert.throws(() => injector.inject(document, { ...request, durationMinutes: 0 }), /zwischen 1 Minute/);
});

test('ein noch anderweitig referenzierter ersetzter Job wird nicht gelöscht', () => {
  const parser = new SiiParser();
  const shared = saveWithFreeSlot
    .replace('job_offer[1]: null', 'job_offer[1]: _nameless.7777.8888.9999')
    .replace('job_offer: 0', 'job_offer: 1\n job_offer[0]: _nameless.7777.8888.9999')
    .replace('\ncompany : company.volatile.eurogoodies.berlin', `
company_job : _nameless.7777.8888.9999 {
 target: "eurogoodies.berlin"
 time_limit: 11900
 cargo: cargo.old
 trailer_variant: trailer.old
 trailer_definition: trailer_def.old
}
company : company.volatile.eurogoodies.berlin`);
  const result = new JobInjector().inject(parser.parse(shared), request);
  assert.equal(result.replacedJobId, '_nameless.7777.8888.9999');
  assert.equal(result.document.units.some((unit) => unit.id === '_nameless.7777.8888.9999'), true);
});
