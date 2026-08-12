import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const port = 39000 + Math.floor(Math.random() * 1000);
const data = await mkdtemp(path.join(os.tmpdir(), "ets2-control-"));
const child = spawn(process.execPath, [path.join(root, "server.mjs")], { cwd: root, env: { ...process.env, PORT: String(port), DATA_DIR: data, COOKIE_SECURE: "false" }, stdio: "pipe" });
async function wait() { for (let i=0;i<40;i++) { try { const r=await fetch(`http://127.0.0.1:${port}/api/bootstrap`); if(r.ok)return; } catch {} await new Promise(r=>setTimeout(r,100)); } throw new Error("Server startete nicht"); }
await wait();
test.after(async () => { child.kill(); await rm(data,{recursive:true,force:true}); });

test("Bootstrap, Login und geschützte API", async () => {
  let r = await fetch(`http://127.0.0.1:${port}/api/bootstrap`); assert.deepEqual(await r.json(), { required:true });
  r = await fetch(`http://127.0.0.1:${port}/api/bootstrap`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({username:"admin",password:"SehrSicheresPasswort123!"})}); assert.equal(r.status,201);
  r = await fetch(`http://127.0.0.1:${port}/api/login`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({username:"admin",password:"SehrSicheresPasswort123!"})}); assert.equal(r.status,200); const login=await r.json(); const cookie=r.headers.get("set-cookie").split(";")[0];
  r = await fetch(`http://127.0.0.1:${port}/api/overview`); assert.equal(r.status,401);
  r = await fetch(`http://127.0.0.1:${port}/api/overview`,{headers:{cookie}}); assert.equal(r.status,200); const overview=await r.json(); assert.equal(overview.config.max_players,8);
  r = await fetch(`http://127.0.0.1:${port}/api/config`,{method:"PUT",headers:{cookie,"x-csrf-token":login.csrf,"content-type":"application/json"},body:JSON.stringify({lobby_name:"Test Lobby",max_players:6})}); assert.equal(r.status,200); assert.equal((await r.json()).max_players,6);
});

test("Statische Oberfläche und Security Headers", async () => {
  let r=await fetch(`http://127.0.0.1:${port}/`); assert.equal(r.status,200); const html=await r.text(); assert.match(html,/ETS2 SERVER CONTROL/); assert.match(html,/name="max_players"[^>]+max="128"/); assert.match(html,/app\.js\?v=3\.0\.0/); assert.equal(r.headers.get("x-frame-options"),"DENY"); assert.match(r.headers.get("cache-control"),/no-store/);
  r=await fetch(`http://127.0.0.1:${port}/app.js?v=3.0.0`); assert.equal(r.status,200); assert.match(r.headers.get("cache-control"),/no-store/);
});

test("ETS2/ATS-Umschaltung, 128 Slots und Telemetrie", async () => {
  let r=await fetch(`http://127.0.0.1:${port}/api/login`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({username:"admin",password:"SehrSicheresPasswort123!"})}); const login=await r.json(),cookie=r.headers.get("set-cookie").split(";")[0];
  r=await fetch(`http://127.0.0.1:${port}/api/config?game=ats`,{method:"PUT",headers:{cookie,"x-csrf-token":login.csrf,"content-type":"application/json"},body:JSON.stringify({lobby_name:"ATS Test",max_players:128})}); assert.equal(r.status,200);assert.equal((await r.json()).max_players,128);
  r=await fetch(`http://127.0.0.1:${port}/api/telemetry/token?game=ats`,{headers:{cookie}});const {token}=await r.json();
  r=await fetch(`http://127.0.0.1:${port}/api/telemetry/ats`,{method:"POST",headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},body:JSON.stringify({name:"RoadKing",steamId:"76561198000000000",ping:24,city:"Phoenix",company:"Wallbert",x:100,z:200,speed:72})});assert.equal(r.status,202);
  r=await fetch(`http://127.0.0.1:${port}/api/overview?game=ats`,{headers:{cookie}});const overview=await r.json();assert.equal(overview.game.id,"ats");assert.equal(overview.game.label,"American Truck Simulator");assert.equal(overview.running,false);assert.equal(overview.config.lobby_name,"ATS Test");assert.equal(overview.config.max_players,128);assert.ok(overview.packages.every(file=>file.present===false));assert.equal(overview.players[0].city,"Phoenix");
  r=await fetch(`http://127.0.0.1:${port}/api/overview?game=ets2`,{headers:{cookie}});const ets=await r.json();assert.equal(ets.game.id,"ets2");assert.equal(ets.config.lobby_name,"Test Lobby");assert.equal(ets.config.max_players,6);
});

test("Lokaler Dispatcher und Save-Adapter sind über die Subdomain nicht erreichbar", async () => {
  for (const route of ["/api/real-dispatch/catalog","/api/real-dispatch/apply","/api/test-save/status","/api/integration/command"]) {
    const r=await fetch(`http://127.0.0.1:${port}${route}`,{method:route.endsWith('/apply')||route.endsWith('/command')?'POST':'GET',headers:{"content-type":"application/json"},body:route.endsWith('/apply')||route.endsWith('/command')?'{}':undefined});
    assert.equal(r.status,404,`${route} darf auf dem Linux-Server nicht existieren`);
  }
});

test("ETS2-Client erhält nur einen kurzlebigen, zunächst unbestätigten Gerätecode", async () => {
  let r=await fetch(`http://127.0.0.1:${port}/api/client/device/start`,{method:"POST"});assert.equal(r.status,201);const device=await r.json();assert.match(device.userCode,/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);assert.match(device.deviceCode,/^[A-Za-z0-9_-]{40,}$/);assert.match(device.verificationUri,/\/api\/client\/auth\/steam\/start\?code=/);
  r=await fetch(`http://127.0.0.1:${port}/api/client/device/token`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({deviceCode:device.deviceCode})});assert.equal(r.status,202);assert.equal((await r.json()).status,"pending");
  r=await fetch(`http://127.0.0.1:${port}/api/client/me`,{headers:{authorization:"Bearer ungueltig"}});assert.equal(r.status,401);
  r=await fetch(`http://127.0.0.1:${port}/client-connect.html?code=${device.userCode}`);assert.equal(r.status,200);assert.match(await r.text(),/VTC Client verbinden/);
});

test("Fahrerkonten und Administratorzugriff bleiben strikt getrennt", async () => {
  let r=await fetch(`http://127.0.0.1:${port}/api/client/register`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({displayName:"Testfahrer"})});
  assert.equal(r.status,201);const registration=await r.json();assert.equal(registration.expiresIn,1800);assert.match(registration.verificationUri,/auth\/steam\/start/);
  r=await fetch(`http://127.0.0.1:${port}/api/login`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({username:"admin",password:"SehrSicheresPasswort123!"})});
  const login=await r.json(),cookie=r.headers.get("set-cookie").split(";")[0];
  r=await fetch(`http://127.0.0.1:${port}/api/admin/drivers`,{headers:{cookie}});assert.equal(r.status,200);assert.ok(Array.isArray((await r.json()).drivers));
  for(const target of ["/api/admin/drivers","/api/server/action?game=ets2"]){r=await fetch(`http://127.0.0.1:${port}${target}`,{method:target.includes('action')?'POST':'GET',headers:{authorization:"Bearer fahrer-token","content-type":"application/json","x-csrf-token":login.csrf},body:target.includes('action')?'{}':undefined});assert.equal(r.status,401);}
});
