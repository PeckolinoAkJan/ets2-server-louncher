import test from 'node:test';
import assert from 'node:assert/strict';
import {IntegrationState} from '../lib/integration-state.mjs';

test('Multiplayer gilt erst mit frischem Plugin-Handshake als spielbereit',()=>{
  const state=new IntegrationState();
  assert.equal(state.pluginReady('ets2'),false);
  state.connectPlugin({game:'ets2',pluginVersion:'0.1.0'});
  assert.equal(state.pluginReady('ets2'),true);
  assert.equal(state.pluginReady('ats'),false);
  state.plugin.lastSeen=Date.now()-6000;
  assert.equal(state.pluginReady('ets2'),false);
});
