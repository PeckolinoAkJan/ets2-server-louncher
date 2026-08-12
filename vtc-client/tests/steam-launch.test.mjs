import test from 'node:test';
import assert from 'node:assert/strict';
import {steamLaunchArguments} from '../lib/game-launch.mjs';

test('startet ETS2 mit dem frischen 64-Bit-Lobbyanteil der SCS-Session-ID',()=>{
  const args=steamLaunchArguments({steamAppId:'227300'},{searchId:'85568392925767505/101'});
  assert.deepEqual(args,['-silent','-applaunch','227300','+connect_lobby','85568392925767505']);
  assert.equal(args.some(value=>String(value).startsWith('steam://')),false);
  assert.equal(args.includes('-connect'),false);
});
test('lehnt manipulierte Session-IDs ab',()=>assert.throws(()=>steamLaunchArguments({steamAppId:'227300'},{searchId:'1 & calc'}),/ungültig/));
