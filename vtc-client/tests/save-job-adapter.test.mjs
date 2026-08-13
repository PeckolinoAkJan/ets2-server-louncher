import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSave,createRealOfferPatch} from '../lib/save-job-adapter.mjs';

const save=`SiiNunit
{
economy : _nameless.0000.0000.0001 {
 game_time: 10000
}
company : company.volatile.a.berlin {
 job_offer: 1
 job_offer[0]: _nameless.one
}
company : company.volatile.b.hamburg {
 job_offer: 0
}
job_offer_data : _nameless.one {
 target: "x.old"
 expiration_time: 10
 urgency: 0
 shortest_distance_km: 10
 ferry_time: 2
 ferry_price: 3
 cargo: cargo.food
 company_truck: truck.a
 trailer_variant: trailer.box
 trailer_definition: trailer_def.box
 units_count: 10
 fill_ratio: 1
 trailer_place: 0
}
job_offer_data : _nameless.template {
 target: "b.hamburg"
 expiration_time: 20
 urgency: 1
 shortest_distance_km: 200
 ferry_time: 0
 ferry_price: 0
 cargo: cargo.milk
 company_truck: truck.b
 trailer_variant: trailer.tank
 trailer_definition: trailer_def.tank
 units_count: 20
 fill_ratio: 1
 trailer_place: 0
}
}
`;

test('liest reale Firmen, Fracht- und Trailerdefinitionen aus dem Save',()=>{const parsed=parseSave(save);assert.equal(parsed.companies.length,2);assert.equal(parsed.offers[1].trailerDefinition,'trailer_def.tank');});
test('erzeugt per AST einen neuen Frachtplatz und übernimmt die Firmenvorlage',()=>{const result=createRealOfferPatch(save,{sourceUnit:'company.volatile.a.berlin',destinationUnit:'company.volatile.b.hamburg',templateOfferId:'_nameless.one',urgency:2,distanceKm:300});assert.match(result.output,/target: "b\.hamburg"/);assert.match(result.output,/cargo: cargo\.food/);assert.match(result.output,/trailer_definition: trailer_def\.box/);assert.match(result.job.offerId,/^_nameless\.[0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4}$/);assert.equal(result.job.timeLimit,11440);assert.equal(parseSave(result.output).offers.length,2);});
test('lehnt eine Vorlage einer anderen Abholfirma ab',()=>assert.throws(()=>createRealOfferPatch(save,{sourceUnit:'company.volatile.a.berlin',destinationUnit:'company.volatile.b.hamburg',templateOfferId:'_nameless.template'}),/nicht freigegeben/));
test('lehnt unbekannte Firmen ab',()=>assert.throws(()=>createRealOfferPatch(save,{sourceUnit:'bad',destinationUnit:'company.volatile.b.hamburg',templateOfferId:'_nameless.template'}),/Quellfirma/));
