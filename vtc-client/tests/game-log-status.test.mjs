import test from 'node:test';
import assert from 'node:assert/strict';
import {parseConnectionStatus,parseGameLogStatus} from '../lib/game-log-status.mjs';

test('erkennt den zuletzt geladenen VTC-Slot',()=>{const s=parseGameLogStatus('x\nLoading save. Type: 0, slot: 0, path: <UFS>/home/profiles/a/save/autosave/game.sii\nLoading save. Type: 5, slot: 3, path: <UFS>/home/profiles/a/save/3/game.sii\n','3');assert.equal(s.expectedLoaded,true);assert.equal(s.loaded.folder,'3')});
test('meldet Jobfehler erst nach dem relevanten Laden',()=>{const s=parseGameLogStatus('<ERROR> cargo.old\nLoading save. Type: 5, slot: 3, path: x/save/3/game.sii\n<ERROR> job_offer_data bad','3');assert.equal(s.adapterErrors.length,1)});
test('erkennt den SCS-Serverbeitritt',()=>{const server={name:'VTC Truck Hub ETS2',searchId:'85568392925767505/101'};assert.equal(parseConnectionStatus('Loading save. Type: 1',server).status,'profile-loaded');const connected=parseConnectionStatus('[MP] Game server joined.\n[MP] Fahrer connected, client_id = 10 [you]',server);assert.equal(connected.status,'connected');assert.match(connected.message,/VTC Truck Hub ETS2/)});
test('meldet eine SCS-Verbindungsablehnung verständlich',()=>{const server={name:'VTC Truck Hub ETS2'};const failed=parseConnectionStatus('[MP] Session closure requested (reason - 33).',server);assert.equal(failed.status,'failed');assert.match(failed.message,/fehlgeschlagen/i)});
test('fordert nach drei Minuten den offiziellen Convoy-Schritt an',()=>{const server={name:'VTC ETS2',searchId:'85568392936581402/101'};const status=parseConnectionStatus('Loading save. Type: 1',server,180001);assert.equal(status.status,'manual_action_required');assert.equal(status.searchTerm,'85568392936581402');assert.match(status.message,/Convoy/)});
