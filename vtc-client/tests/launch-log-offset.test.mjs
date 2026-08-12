import test from 'node:test';
import assert from 'node:assert/strict';
import { currentLaunchLog, parseConnectionStatus } from '../lib/game-log-status.mjs';

test('verwirft einen alten Offset wenn ETS2 game.log neu erstellt',()=>{
  const log='[MP] Game server joined.\n';
  assert.equal(currentLaunchLog(log,757133),log);
  assert.equal(parseConnectionStatus(currentLaunchLog(log,757133),{name:'VTC Truck Hub ETS2'}).status,'connected');
});

test('behält einen gültigen Offset für einen fortgeschriebenen Log',()=>{
  const joined='[MP] Game server joined.\n';
  assert.equal(currentLaunchLog(`alt\n${joined}`,4),joined);
});
