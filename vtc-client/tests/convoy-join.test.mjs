import test from 'node:test';
import assert from 'node:assert/strict';
import {convoyJoinRequest,convoySearchTerm} from '../lib/convoy-join.mjs';

test('trennt SCS-Suchbegriff von der vollständigen Search ID',()=>{
  assert.equal(convoySearchTerm('85568392936581402/101'),'85568392936581402');
  const request=convoyJoinRequest('ets2',{id:'eu-1',name:'VTC ETS2',searchId:'85568392936581402/101'});
  assert.equal(request.fullSearchId,'85568392936581402/101');
  assert.equal(request.searchTerm,'85568392936581402');
});

test('verwirft manipulierte oder unvollständige Search IDs',()=>{
  for(const value of ['','123','85568392936581402/101 & calc','abc/101'])assert.throws(()=>convoySearchTerm(value),/ungültig/);
});
