import test from 'node:test';
import assert from 'node:assert/strict';
import {steamLaunchArguments} from '../lib/game-launch.mjs';

test('missbraucht die SCS-Search-ID nicht als Steam-Lobby-ID',()=>{
  const args=steamLaunchArguments({steamAppId:'227300'},{searchId:'85568392925767505/101'});
  assert.deepEqual(args,['-silent','-applaunch','227300']);
  assert.equal(args.includes('+connect_lobby'),false);
  assert.equal(args.some(value=>String(value).startsWith('steam://')),false);
  assert.equal(args.includes('-connect'),false);
});
test('lehnt manipulierte Session-IDs ab',()=>assert.throws(()=>steamLaunchArguments({steamAppId:'227300'},{searchId:'1 & calc'}),/ungültig/));
