import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';

const port=27910;
const child=spawn(process.execPath,['launcher.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,VTC_LOCAL_PORT:String(port)},stdio:'pipe'});
async function wait(){for(let i=0;i<30;i++){try{const r=await fetch(`http://127.0.0.1:${port}/api/status`);if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('Launcher startete nicht');}
await wait();test.after(()=>child.kill());
test('ETS2- und ATS-Launcher-API starten lokal; beide Spiele bleiben getrennt',async()=>{
  let r=await fetch(`http://127.0.0.1:${port}/`);assert.equal(r.status,200);const html=await r.text();assert.match(html,/Deutscher Fracht-Dispatcher/);assert.match(html,/value="owned" disabled/);
  r=await fetch(`http://127.0.0.1:${port}/api/catalog?game=ets2&profile=promods`);const c=await r.json();assert.equal(c.game,'ets2');
  r=await fetch(`http://127.0.0.1:${port}/api/catalog?game=ats&profile=promods`);assert.equal(r.status,200);const ats=await r.json();assert.equal(ats.game,'ats');
  r=await fetch(`http://127.0.0.1:${port}/api/servers?game=ats`);assert.equal(r.status,200);const servers=await r.json();assert.ok(servers.servers.every(s=>s.game==='ats'));
  r=await fetch(`http://127.0.0.1:${port}/api/real-dispatch/catalog`);assert.equal(r.status,401);
  r=await fetch(`http://127.0.0.1:${port}/api/dev/link`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.equal(r.status,404);
});
