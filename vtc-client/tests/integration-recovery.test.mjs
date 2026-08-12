import test from 'node:test';
import assert from 'node:assert/strict';
import { IntegrationState } from '../lib/integration-state.mjs';

test('Heartbeat meldet das Plugin nach einem Launcher-Neustart selbstheilend wieder an', () => {
  const integration = new IntegrationState();
  const state = integration.heartbeat({ game: 'ets2', pluginVersion: '0.1.0', profileId: 'native' });
  assert.equal(state.pluginReady, true);
  assert.equal(state.plugin.game, 'ets2');
});
