import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog, compatibleCargo, buildOffer } from '../lib/catalog.mjs';

test('ETS2 Standard und ProMods bleiben getrennt und werden erweitert',async()=>{
  const standard=await loadCatalog('ets2','standard'),promods=await loadCatalog('ets2','promods');
  assert.equal(standard.game,'ets2');assert.equal(standard.cities.some(c=>c.id==='kirkenes'),false);assert.equal(promods.cities.some(c=>c.id==='kirkenes'),true);
});

test('ATS-Katalog enthält keine ETS2-Städte',async()=>{
  const ats=await loadCatalog('ats','standard');assert.equal(ats.cities.some(c=>c.id==='berlin'),false);assert.equal(ats.cities.some(c=>c.id==='phoenix'),true);
});

test('nur realistisch kompatible Fracht kann reserviert werden',async()=>{
  const catalog=await loadCatalog('ets2','standard');
  const cargo=compatibleCargo(catalog,'tradeaux','eurogoodies');assert.ok(cargo.some(c=>c.id==='apples'));assert.equal(cargo.some(c=>c.id==='tractors'),false);
  const offer=buildOffer(catalog,{sourceCity:'berlin',sourceCompany:'tradeaux',destinationCity:'paris',destinationCompany:'eurogoodies',cargo:'apples',trailer:'reefer',trailerMode:'provided'});assert.equal(offer.trailer.mode,'provided');assert.equal(offer.status,'reserved');
  assert.throws(()=>buildOffer(catalog,{sourceCity:'berlin',sourceCompany:'tradeaux',destinationCity:'paris',destinationCompany:'eurogoodies',cargo:'tractors',trailer:'lowbed'}),/nicht realistisch kompatibel/);
});
