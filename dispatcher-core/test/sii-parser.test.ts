import test from 'node:test';
import assert from 'node:assert/strict';
import { SiiParser } from '../src/sii-parser.ts';
import { SiiSyntaxError } from '../src/sii-types.ts';
import { saveWithFreeSlot } from './fixture.ts';

test('SII-Parser erzeugt Units und Properties ohne Regex-Manipulation', () => {
  const parser = new SiiParser();
  const document = parser.parse(saveWithFreeSlot);
  assert.equal(document.units.length, 5);
  const company = document.units.find((unit) => unit.id === 'company.volatile.lkwlog.hamburg');
  assert.equal(company?.properties.filter((property) => property.key === 'job_offer' && property.index !== null).length, 3);
  assert.equal(company?.properties.find((property) => property.index === 1)?.value.raw, 'null');
});

test('Parser-Serialisierung ist strukturell roundtrip-fähig und erhält unbekannte Felder', () => {
  const parser = new SiiParser();
  const first = parser.parse(saveWithFreeSlot);
  const second = parser.parse(parser.serialize(first));
  assert.deepEqual(second, first);
  assert.equal(second.units.find((unit) => unit.id === '_nameless.1111.2222.3333')?.properties.find((property) => property.key === 'unknown_version_field')?.value.raw, '(1, 2, 3)');
});

test('Parser meldet Positionen bei beschädigtem SII', () => {
  assert.throws(() => new SiiParser().parse('SiiNunit\n{\ncompany : broken {\n value: "offen\n}'), (error: unknown) => {
    assert.ok(error instanceof SiiSyntaxError);
    assert.match(error.message, /Zeile/);
    return true;
  });
});
