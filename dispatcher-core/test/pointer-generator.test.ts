import test from 'node:test';
import assert from 'node:assert/strict';
import { PointerGenerator } from '../../vtc-client/lib/dispatcher-core/index.js';

test('PointerGenerator überspringt Kollisionen und reserviert neue IDs sofort', () => {
  const values = [Buffer.from('aabbccddeeff', 'hex'), Buffer.from('001122334455', 'hex'), Buffer.from('66778899aabb', 'hex')];
  const generator = new PointerGenerator(['_nameless.aabb.ccdd.eeff'], () => values.shift() ?? Buffer.alloc(6));
  assert.equal(generator.next(), '_nameless.0011.2233.4455');
  assert.equal(generator.next(), '_nameless.6677.8899.aabb');
});

test('PointerGenerator validiert die Zufallsquelle', () => {
  const generator = new PointerGenerator([], () => Buffer.alloc(5));
  assert.throws(() => generator.next(), /sechs Bytes/);
});

test('fromDocument berücksichtigt auch Pointer in Property-Verweisen', () => {
  const document = {kind:'document',units:[{kind:'unit',unitType:'economy',id:'economy',properties:[{kind:'property',key:'link',index:null,value:{kind:'scalar',raw:'_nameless.aabb.ccdd.eeff'}}]}]};
  const values = [Buffer.from('aabbccddeeff', 'hex'), Buffer.from('001122334455', 'hex')];
  const generator = PointerGenerator.fromDocument(document as never, () => values.shift() ?? Buffer.alloc(6));
  assert.equal(generator.next(), '_nameless.0011.2233.4455');
});
