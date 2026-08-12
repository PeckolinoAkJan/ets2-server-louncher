import http from "node:http";
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const DATA = process.env.DATA_DIR || path.join(ROOT, "data");
const BACKUPS = path.join(DATA, "backups");
const PUBLIC = path.join(ROOT, "public");
const USERS_FILE = path.join(DATA, "users.json");
const DRIVERS_FILE = path.join(DATA, "drivers.json");
const CLIENT_SESSIONS_FILE = path.join(DATA, "client-sessions.json");
const AUDIT_FILE = path.join(DATA, "audit.log");
const sessions = new Map();
const attempts = new Map();
const installs = new Map();
const telemetry = new Map([["ets2", new Map()], ["ats", new Map()]]);
const clientDevices = new Map();
const steamStates = new Map();
const clientTokens = new Map();
const PUBLIC_URL = String(process.env.PUBLIC_URL || "https://ets-server.vtc-truck-hub.de").replace(/\/$/, "");
const STEAM_OPENID = "https://steamcommunity.com/openid/login";

const games = {
  ets2: { id: "ets2", label: "Euro Truck Simulator 2", short: "ETS2", appId: 1948160, binary: "eurotrucks2_server", home: process.env.ETS2_HOME || path.join(DATA, "Euro Truck Simulator 2"), server: process.env.ETS2_SERVER_DIR || path.join(DATA, "ets2-server"), config: path.join(DATA, "panel-config.json"), pid: path.join(DATA, "ets2.pid"), installLog: path.join(DATA, "install.log"), ports: [27015, 27016] },
  ats: { id: "ats", label: "American Truck Simulator", short: "ATS", appId: 2239530, binary: "amtrucks_server", home: path.join(DATA, "American Truck Simulator"), server: path.join(DATA, "ats-server"), config: path.join(DATA, "ats-panel-config.json"), pid: path.join(DATA, "ats.pid"), installLog: path.join(DATA, "ats-install.log"), ports: [27017, 27018] }
};

for (const dir of [DATA, BACKUPS, ...Object.values(games).flatMap(g => [g.home, g.server])]) mkdirSync(dir, { recursive: true });

const defaults = {
  lobby_name: "VTC Truck Hub",
  description: "Willkommen auf unserem ETS2 Community-Server",
  welcome_message: "Gute Fahrt und viel Spaß!",
  password: "",
  max_players: 8,
  connection_virtual_port: 100,
  query_virtual_port: 101,
  connection_dedicated_port: 27015,
  query_dedicated_port: 27016,
  server_logon_token: "",
  server_name: "Community Server #1",
  backup_retention: 10,
  telemetry_token: ""
};

function readJson(file, fallback) {
  try { return JSON.parse(readFileSync(file, "utf8")); } catch { return fallback; }
}
function atomicJson(file, value) {
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(tmp, file);
}
function tokenHash(token){return crypto.createHash('sha256').update(String(token)).digest('hex');}
function loadClientSessions(){for(const item of readJson(CLIENT_SESSIONS_FILE,[]))if(item.hash&&item.expires>Date.now())clientTokens.set(item.hash,item);}
function saveClientSessions(){const now=Date.now(),items=[...clientTokens.values()].filter(item=>item.expires>now);clientTokens.clear();for(const item of items)clientTokens.set(item.hash,item);atomicJson(CLIENT_SESSIONS_FILE,items);}
function clientAccount(req){const token=String(req.headers.authorization||"").replace(/^Bearer\s+/i,""),record=clientTokens.get(tokenHash(token));return record&&record.expires>Date.now()?record:null;}
function drivers(){return readJson(DRIVERS_FILE,[]);}
function publicDriver(d){return{id:d.id,displayName:d.displayName,steamId:d.steamId||"",status:d.status||"pending",registeredAt:d.registeredAt,lastLoginAt:d.lastLoginAt||null};}
function findDriverBySteam(steamId){return drivers().find(d=>String(d.steamId||"")===String(steamId));}
function migrateLegacyDrivers(){const list=drivers();let changed=false;for(const user of readJson(USERS_FILE,[])){if(user.steamId&&!list.some(d=>d.steamId===user.steamId)){list.push({id:crypto.randomUUID(),displayName:user.username,steamId:user.steamId,status:"approved",registeredAt:new Date().toISOString(),lastLoginAt:null});changed=true;}}if(changed)atomicJson(DRIVERS_FILE,list);}
loadClientSessions();
migrateLegacyDrivers();
function gameFrom(value) { return games[String(value || "ets2").toLowerCase()] || games.ets2; }
function getConfig(game = games.ets2) {
  const base = game.id === "ats" ? { ...defaults, lobby_name: "VTC Truck Hub ATS", description: "Willkommen auf unserem ATS Community-Server", server_name: "ATS Community Server", connection_dedicated_port: 27017, query_dedicated_port: 27018 } : defaults;
  const config = { ...base, ...readJson(game.config, {}) };
  if (!config.telemetry_token) { config.telemetry_token = crypto.randomBytes(24).toString("base64url"); atomicJson(game.config, config); }
  return config;
}
function publicConfig(config = getConfig()) { const { telemetry_token, ...safe } = config; return { ...safe, password: "", server_logon_token: "", telemetry_enabled: Boolean(telemetry_token) }; }
function safeText(value, max) { return String(value ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max); }
function sii(value) { return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"'); }
function writeServerConfig(game, config) {
  const body = `SiiNunit\n{\nserver_config : _nameless.001 {\n lobby_name: "${sii(config.lobby_name)}"\n description: "${sii(config.description)}"\n welcome_message: "${sii(config.welcome_message)}"\n password: "${sii(config.password)}"\n max_players: ${config.max_players}\n max_vehicles_total: 100\n max_ai_vehicles_player: 50\n max_ai_vehicles_player_spawn: 50\n connection_virtual_port: ${config.connection_virtual_port}\n query_virtual_port: ${config.query_virtual_port}\n connection_dedicated_port: ${config.connection_dedicated_port}\n query_dedicated_port: ${config.query_dedicated_port}\n server_logon_token: "${sii(config.server_logon_token)}"\n pause_game: false\n hide_in_company: false\n hide_colliding: true\n service_no_collision: false\n in_menu_ghosting: false\n name_tags: true\n friends_only: false\n show_server: true\n moderator_list: 0\n}\n}\n`;
  writeFileSync(path.join(game.home, "server_config.sii"), body, { mode: 0o600 });
}
for (const game of Object.values(games)) { const config = getConfig(game); if (!existsSync(path.join(game.home, "server_config.sii"))) writeServerConfig(game, config); }

function cookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split(";").map(v => v.trim()).filter(Boolean).map(v => { const i = v.indexOf("="); return [v.slice(0, i), decodeURIComponent(v.slice(i + 1))]; }));
}
function session(req) {
  const token = cookies(req).ets2_session;
  const entry = token && sessions.get(token);
  if (!entry || entry.expires < Date.now()) { if (token) sessions.delete(token); return null; }
  entry.expires = Date.now() + 12 * 60 * 60 * 1000;
  return entry;
}
function send(res, status, payload, extra = {}) {
  const data = typeof payload === "string" ? payload : JSON.stringify(payload);
  res.writeHead(status, { "Content-Type": typeof payload === "string" ? "text/plain; charset=utf-8" : "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra });
  res.end(data);
}
function redirect(res, location) { res.writeHead(302, { Location: location, "Cache-Control": "no-store" }); res.end(); }
function randomUserCode() { const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let out=""; for(let i=0;i<8;i++)out+=alphabet[crypto.randomInt(alphabet.length)]; return `${out.slice(0,4)}-${out.slice(4)}`; }
function steamLoginUrl(returnUrl) { const u=new URL(STEAM_OPENID);for(const [k,v] of Object.entries({"openid.ns":"http://specs.openid.net/auth/2.0","openid.mode":"checkid_setup","openid.return_to":returnUrl,"openid.realm":`${PUBLIC_URL}/`,"openid.identity":"http://specs.openid.net/auth/2.0/identifier_select","openid.claimed_id":"http://specs.openid.net/auth/2.0/identifier_select"}))u.searchParams.set(k,v);return u.toString(); }
async function verifySteamOpenId(url) {
  if(url.searchParams.get("openid.mode")!=="id_res")throw new Error("Steam-Anmeldung wurde nicht bestätigt");
  const claimed=url.searchParams.get("openid.claimed_id")||"";const match=claimed.match(/^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/);if(!match)throw new Error("Steam-ID ist ungültig");
  const params=new URLSearchParams();for(const [key,value] of url.searchParams)if(key.startsWith("openid."))params.set(key,value);params.set("openid.mode","check_authentication");
  const response=await fetch(STEAM_OPENID,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:params});if(!response.ok||!/^is_valid:true$/m.test(await response.text()))throw new Error("Steam konnte die Anmeldung nicht verifizieren");return match[1];
}
function security(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
}
async function body(req, limit = 2_000_000) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > limit) throw new Error("PAYLOAD_TOO_LARGE"); chunks.push(chunk); }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString("hex") };
}
function verifyPassword(password, user) {
  const candidate = crypto.scryptSync(password, user.salt, 64);
  const stored = Buffer.from(user.hash, "hex");
  return candidate.length === stored.length && crypto.timingSafeEqual(candidate, stored);
}
function audit(user, action, detail = "") {
  writeFileSync(AUDIT_FILE, `${new Date().toISOString()}\t${user || "system"}\t${action}\t${safeText(detail, 240)}\n`, { flag: "a" });
}
function requireAuth(req, res, mutation = false) {
  const s = session(req);
  if (!s) { send(res, 401, { error: "Nicht angemeldet" }); return null; }
  if (mutation && req.headers["x-csrf-token"] !== s.csrf) { send(res, 403, { error: "Ungültige Sicherheitsanfrage" }); return null; }
  return s;
}
function running(game) {
  try { const pid = Number(readFileSync(game.pid, "utf8")); process.kill(pid, 0); return { running: true, pid }; } catch { return { running: false, pid: null }; }
}
function tail(file, count = 200) {
  try { return readFileSync(file, "utf8").split(/\r?\n/).slice(-count).join("\n"); } catch { return "Noch keine Protokolle vorhanden."; }
}
function runScript(game, name, args = [], detached = false) {
  const script = path.join(ROOT, "scripts", name);
  return new Promise((resolve, reject) => {
    const child = spawn("bash", [script, ...args], { env: { ...process.env, DATA_DIR: DATA, ETS2_HOME: game.home, ETS2_SERVER_DIR: game.server, GAME_ID: game.id, GAME_LABEL: game.label, GAME_APP_ID: String(game.appId), GAME_BINARY: game.binary, PID_FILE: game.pid, INSTALL_LOG: game.installLog }, detached, stdio: detached ? "ignore" : ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    child.stdout?.on("data", d => out += d);
    child.stderr?.on("data", d => err += d);
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve(out.trim()) : reject(new Error((err || out || `Exit ${code}`).slice(-1000))));
    if (detached) child.unref();
  });
}
function systemMetrics() {
  const total = os.totalmem(), free = os.freemem();
  return { cpu: Math.round(os.loadavg()[0] / Math.max(os.cpus().length, 1) * 100), ramPercent: Math.round((total - free) / total * 100), ramUsed: total - free, ramTotal: total, uptime: os.uptime() };
}
function safeBackupName(name) { return /^[a-zA-Z0-9._-]+\.tar\.gz$/.test(name || "") ? name : null; }
function listBackups(game) {
  return readdirSync(BACKUPS).filter(n => safeBackupName(n) && n.startsWith(`${game.id}-`)).map(name => { const s = statSync(path.join(BACKUPS, name)); return { name, size: s.size, created: s.mtime.toISOString() }; }).sort((a,b) => b.created.localeCompare(a.created));
}
function packageState(game) {
  return ["server_packages.sii", "server_packages.dat"].map(name => { const file = path.join(game.home, name); return { name, present: existsSync(file), size: existsSync(file) ? statSync(file).size : 0 }; });
}
function serverLog(game) { return path.join(game.home, "server.log.txt"); }
function logPlayers(game) {
  const text = tail(serverLog(game), 2000), found = new Map();
  for (const line of text.split(/\r?\n/)) {
    const join = line.match(/(?:joined|connected|player added).*?(?:name[=: ]+)?["']?([^"'|,]+?)["']?(?:[,| ].*?(?:steam(?:_id)?|id)[=: ]+([0-9]{15,20}))?$/i);
    const leave = line.match(/(?:left|disconnected|player removed).*?(?:name[=: ]+)?["']?([^"'|,]+?)["']?$/i);
    if (join) { const name = safeText(join[1], 50); if (name) found.set(name.toLowerCase(), { name, steamId: join[2] || "–", ping: null, city: "–", company: "–", source: "Server-Log", updatedAt: Date.now() }); }
    if (leave) found.delete(safeText(leave[1], 50).toLowerCase());
  }
  return [...found.values()];
}
function livePlayers(game) {
  const now = Date.now(), map = telemetry.get(game.id); for (const [id,p] of map) if (now - p.updatedAt > 30_000) map.delete(id);
  const merged = new Map(logPlayers(game).map(p => [(p.steamId !== "–" ? p.steamId : p.name.toLowerCase()), p]));
  for (const p of map.values()) merged.set(p.steamId || p.name.toLowerCase(), p);
  return [...merged.values()];
}
function loginLimited(ip) {
  const now = Date.now(), list = (attempts.get(ip) || []).filter(t => now - t < 15 * 60_000);
  attempts.set(ip, list); return list.length >= 8;
}

async function api(req, res, url) {
  const users = readJson(USERS_FILE, []);
  const game = gameFrom(url.searchParams.get("game"));
  if(url.pathname==="/api/client/device/start"&&req.method==="POST"){
    let userCode;do{userCode=randomUserCode()}while([...clientDevices.values()].some(d=>d.userCode===userCode));const deviceCode=crypto.randomBytes(32).toString("base64url");
    clientDevices.set(deviceCode,{userCode,status:"pending",expires:Date.now()+10*60_000});return send(res,201,{deviceCode,userCode,verificationUri:`${PUBLIC_URL}/api/client/auth/steam/start?code=${encodeURIComponent(userCode)}`,expiresIn:600,interval:2});
  }
  if(url.pathname==="/api/client/device/token"&&req.method==="POST"){
    const input=await body(req),record=clientDevices.get(String(input.deviceCode||""));if(!record||record.expires<Date.now())return send(res,410,{error:"Gerätecode ist abgelaufen"});if(record.status!=="approved")return send(res,202,{status:record.status});
    const accessToken=crypto.randomBytes(32).toString("base64url"),stored={hash:tokenHash(accessToken),...record.account,expires:Date.now()+30*24*60*60_000};clientTokens.set(stored.hash,stored);saveClientSessions();clientDevices.delete(String(input.deviceCode));return send(res,200,{status:"approved",accessToken,account:record.account,expiresIn:2592000});
  }
  if(url.pathname==="/api/client/register"&&req.method==="POST"){
    const input=await body(req),displayName=safeText(input.displayName,40);if(displayName.length<3)return send(res,400,{error:"Fahrername muss mindestens 3 Zeichen lang sein"});
    let userCode;do{userCode=randomUserCode()}while([...clientDevices.values()].some(d=>d.userCode===userCode));const deviceCode=crypto.randomBytes(32).toString("base64url");
    clientDevices.set(deviceCode,{userCode,status:"pending",displayName,registration:true,expires:Date.now()+30*60_000});return send(res,201,{deviceCode,userCode,verificationUri:`${PUBLIC_URL}/api/client/auth/steam/start?code=${encodeURIComponent(userCode)}`,expiresIn:1800,interval:2});
  }
  if(url.pathname==="/api/client/me"&&req.method==="GET"){
    const account=clientAccount(req);if(!account)return send(res,401,{error:"Client-Anmeldung abgelaufen"});return send(res,200,{account:{steamId:account.steamId,vtcAccountId:account.vtcAccountId,displayName:account.displayName}});
  }
  const clientTelemetryMatch=url.pathname.match(/^\/api\/client\/telemetry\/(ets2|ats)$/);if(clientTelemetryMatch&&req.method==="POST"){
    const account=clientAccount(req);if(!account)return send(res,401,{error:"Client-Anmeldung abgelaufen"});
    const target=games[clientTelemetryMatch[1]],input=await body(req),num=v=>Number.isFinite(Number(v))?Number(v):null,id=account.steamId;
    telemetry.get(target.id).set(id,{name:safeText(account.displayName,50),steamId:account.steamId,ping:Math.max(0,Math.min(9999,num(input.ping)??0)),city:safeText(input.city,60)||"–",company:safeText(input.company,60)||"–",x:num(input.x),y:num(input.y),z:num(input.z),heading:num(input.heading),speed:num(input.speed),source:"VTC Client",updatedAt:Date.now()});return send(res,202,{ok:true});
  }
  if(url.pathname==="/api/client/auth/steam/start"&&req.method==="GET"){
    const code=String(url.searchParams.get("code")||"").toUpperCase(),entry=[...clientDevices.entries()].find(([,d])=>d.userCode===code&&d.expires>Date.now());if(!entry)return send(res,410,{error:"Gerätecode ist ungültig oder abgelaufen"});
    const state=crypto.randomBytes(24).toString("base64url");steamStates.set(state,{deviceCode:entry[0],expires:Date.now()+10*60_000});return redirect(res,steamLoginUrl(`${PUBLIC_URL}/api/client/auth/steam/callback?state=${encodeURIComponent(state)}`));
  }
  if(url.pathname==="/api/client/auth/steam/callback"&&req.method==="GET"){
    const state=String(url.searchParams.get("state")||""),pending=steamStates.get(state);steamStates.delete(state);if(!pending||pending.expires<Date.now())return send(res,410,"Steam-Anmeldung ist abgelaufen.");
    try{const steamId=await verifySteamOpenId(url),record=clientDevices.get(pending.deviceCode);if(!record||record.expires<Date.now())throw new Error("Gerätecode ist abgelaufen");record.steamId=steamId;let list=drivers(),linked=list.find(d=>String(d.steamId||"")===steamId);if(!linked&&record.registration){linked={id:crypto.randomUUID(),displayName:record.displayName,steamId,status:"pending",registeredAt:new Date().toISOString(),lastLoginAt:null};list.push(linked);atomicJson(DRIVERS_FILE,list);audit(linked.displayName,"driver_registered",steamId);}if(!linked){record.status="registration_required";throw new Error("Noch kein Fahrerkonto vorhanden. Registriere dich zuerst im Launcher.");}if(linked.status==="blocked"){record.status="blocked";throw new Error("Dieses Fahrerkonto wurde gesperrt.");}if(linked.status!=="approved"){record.status="approval_required";return send(res,200,"Registrierung abgeschlossen. Ein Administrator muss dein Fahrerkonto noch freigeben. Der Launcher wartet automatisch.",{"Content-Type":"text/plain; charset=utf-8"});}linked.lastLoginAt=new Date().toISOString();atomicJson(DRIVERS_FILE,list);record.status="approved";record.account={steamId,vtcAccountId:linked.id,displayName:linked.displayName,role:"driver"};audit(linked.displayName,"driver_login",steamId);return send(res,200,"Steam-Anmeldung erfolgreich. Du kannst dieses Fenster schließen.",{"Content-Type":"text/plain; charset=utf-8"});}catch(error){audit("steam","client_steam_login_failed",error.message);return send(res,400,error.message);}
  }
  if(url.pathname==="/api/admin/drivers"&&req.method==="GET"){const s=requireAuth(req,res);if(!s)return;return send(res,200,{drivers:drivers().map(publicDriver)});}
  const driverMatch=url.pathname.match(/^\/api\/admin\/drivers\/([^/]+)$/);if(driverMatch&&req.method==="PUT"){
    const s=requireAuth(req,res,true);if(!s)return;const input=await body(req),allowed=["pending","approved","blocked"];if(!allowed.includes(input.status))return send(res,400,{error:"Ungültiger Fahrerstatus"});const list=drivers(),item=list.find(d=>d.id===driverMatch[1]);if(!item)return send(res,404,{error:"Fahrerkonto nicht gefunden"});item.status=input.status;atomicJson(DRIVERS_FILE,list);if(item.status==="approved")for(const record of clientDevices.values())if(record.steamId===item.steamId){record.status="approved";record.account={steamId:item.steamId,vtcAccountId:item.id,displayName:item.displayName,role:"driver"};}if(item.status==="blocked")for(const record of clientDevices.values())if(record.steamId===item.steamId)record.status="blocked";audit(s.user,"driver_status",`${item.displayName}: ${item.status}`);return send(res,200,{driver:publicDriver(item)});
  }
  if(driverMatch&&req.method==="DELETE"){const s=requireAuth(req,res,true);if(!s)return;const list=drivers(),index=list.findIndex(d=>d.id===driverMatch[1]);if(index<0)return send(res,404,{error:"Fahrerkonto nicht gefunden"});const [item]=list.splice(index,1);atomicJson(DRIVERS_FILE,list);for(const [hash,t] of clientTokens)if(t.vtcAccountId===item.id)clientTokens.delete(hash);saveClientSessions();audit(s.user,"driver_delete",item.displayName);return send(res,200,{ok:true});}
  if (url.pathname === "/api/bootstrap" && req.method === "GET") return send(res, 200, { required: users.length === 0 });
  if (url.pathname === "/api/bootstrap" && req.method === "POST") {
    if (users.length) return send(res, 409, { error: "Einrichtung bereits abgeschlossen" });
    const data = await body(req), username = safeText(data.username, 40), password = String(data.password || "");
    if (username.length < 3 || password.length < 12) return send(res, 400, { error: "Benutzername ab 3 Zeichen und Passwort ab 12 Zeichen erforderlich" });
    const hashed = hashPassword(password); atomicJson(USERS_FILE, [{ id: crypto.randomUUID(), username, role: "admin", ...hashed }]); audit(username, "bootstrap", "Erstes Administratorkonto erstellt");
    return send(res, 201, { ok: true });
  }
  if (url.pathname === "/api/login" && req.method === "POST") {
    const ip = req.socket.remoteAddress || "unknown";
    if (loginLimited(ip)) return send(res, 429, { error: "Zu viele Versuche. Bitte 15 Minuten warten." });
    const data = await body(req), user = users.find(u => u.username.toLowerCase() === String(data.username || "").toLowerCase());
    if (!user || !verifyPassword(String(data.password || ""), user)) { attempts.get(ip).push(Date.now()); audit(data.username, "login_failed", ip); return send(res, 401, { error: "Anmeldedaten ungültig" }); }
    attempts.delete(ip); const token = crypto.randomBytes(32).toString("base64url"), csrf = crypto.randomBytes(24).toString("base64url");
    sessions.set(token, { user: user.username, role: user.role, csrf, expires: Date.now() + 12 * 60 * 60_000 }); audit(user.username, "login");
    return send(res, 200, { ok: true, csrf }, { "Set-Cookie": `ets2_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${process.env.COOKIE_SECURE === "false" ? "" : "; Secure"}` });
  }
  if (url.pathname === "/api/logout" && req.method === "POST") {
    const s = requireAuth(req, res, true); if (!s) return; const token = cookies(req).ets2_session; sessions.delete(token); audit(s.user, "logout");
    return send(res, 200, { ok: true }, { "Set-Cookie": "ets2_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0" });
  }
  if (url.pathname === "/api/me" && req.method === "GET") { const s = requireAuth(req, res); if (!s) return; return send(res, 200, { user: s.user, role: s.role, csrf: s.csrf }); }
  if (url.pathname === "/api/overview" && req.method === "GET") {
    const s = requireAuth(req, res); if (!s) return;
    const config = getConfig(), state = running(), log = tail(SERVER_LOG, 150);
    const searchId = log.match(/search id[^\d]*(\d+)/i)?.[1] || "–";
    return send(res, 200, { ...state, installed: existsSync(path.join(ETS2_SERVER, "bin/linux_x64/eurotrucks2_server")), installing: Boolean(installProcess), config: publicConfig(config), packages: packageState(), metrics: systemMetrics(), searchId, players: [] });
  }
  if (url.pathname === "/api/config" && req.method === "GET") { const s = requireAuth(req, res); if (!s) return; return send(res, 200, publicConfig()); }
  if (url.pathname === "/api/config" && req.method === "PUT") {
    const s = requireAuth(req, res, true); if (!s) return; const input = await body(req); const old = getConfig();
    const next = { ...old, lobby_name: safeText(input.lobby_name, 63), description: safeText(input.description, 63), welcome_message: safeText(input.welcome_message, 127), password: input.password ? safeText(input.password, 63) : old.password, server_logon_token: input.server_logon_token ? safeText(input.server_logon_token, 128) : old.server_logon_token, server_name: safeText(input.server_name, 63), max_players: Math.min(8, Math.max(1, Number(input.max_players) || 8)), backup_retention: Math.min(50, Math.max(1, Number(input.backup_retention) || 10)) };
    atomicJson(CONFIG_FILE, next); writeServerConfig(next); audit(s.user, "config_update", next.lobby_name); return send(res, 200, publicConfig(next));
  }
  if (url.pathname === "/api/logs" && req.method === "GET") { const s = requireAuth(req, res); if (!s) return; const kind = url.searchParams.get("kind"); return send(res, 200, { text: tail(kind === "install" ? INSTALL_LOG : SERVER_LOG, Math.min(1000, Number(url.searchParams.get("limit")) || 300)) }); }
  if (url.pathname === "/api/audit" && req.method === "GET") { const s = requireAuth(req, res); if (!s) return; return send(res, 200, { text: tail(AUDIT_FILE, 300) }); }
  if (url.pathname === "/api/server/install" && req.method === "POST") {
    const s = requireAuth(req, res, true); if (!s) return; if (installProcess) return send(res, 409, { error: "Installation läuft bereits" });
    audit(s.user, "install_start"); writeFileSync(INSTALL_LOG, `${new Date().toISOString()} Installation gestartet\n`, { flag: "a" });
    installProcess = runScript("install-ets2.sh").then(out => { writeFileSync(INSTALL_LOG, `${out}\nInstallation abgeschlossen.\n`, { flag: "a" }); audit(s.user, "install_complete"); }).catch(e => { writeFileSync(INSTALL_LOG, `FEHLER: ${e.message}\n`, { flag: "a" }); audit(s.user, "install_failed", e.message); }).finally(() => installProcess = null);
    return send(res, 202, { ok: true, message: "Installation gestartet" });
  }
  if (url.pathname === "/api/server/action" && req.method === "POST") {
    const s = requireAuth(req, res, true); if (!s) return; const data = await body(req), action = data.action;
    if (!['start','stop','restart','update'].includes(action)) return send(res, 400, { error: "Unbekannte Aktion" });
    if ((action === 'start' || action === 'restart') && packageState().some(f => !f.present)) return send(res, 409, { error: "server_packages.sii und server_packages.dat müssen zuerst hochgeladen werden" });
    try { const out = action === "update" ? await runScript("install-ets2.sh") : await runScript(`${action}-ets2.sh`); audit(s.user, `server_${action}`); return send(res, 200, { ok: true, message: out || `Server: ${action}` }); }
    catch (e) { audit(s.user, `server_${action}_failed`, e.message); return send(res, 500, { error: e.message }); }
  }
  if (url.pathname === "/api/packages" && req.method === "POST") {
    const s = requireAuth(req, res, true); if (!s) return; const data = await body(req, 55_000_000); const name = String(data.name || "");
    if (!['server_packages.sii','server_packages.dat'].includes(name)) return send(res, 400, { error: "Nur ETS2-Serverpaketdateien sind erlaubt" });
    const buffer = Buffer.from(String(data.contentBase64 || ""), "base64"); if (!buffer.length || buffer.length > 40_000_000) return send(res, 400, { error: "Datei leer oder zu groß (max. 40 MB)" });
    writeFileSync(path.join(ETS2_HOME, name), buffer, { mode: 0o600 }); audit(s.user, "package_upload", `${name} ${buffer.length}B`); return send(res, 201, { ok: true });
  }
  if (url.pathname === "/api/backups" && req.method === "GET") { const s = requireAuth(req, res); if (!s) return; return send(res, 200, { backups: listBackups() }); }
  if (url.pathname === "/api/backups" && req.method === "POST") {
    const s = requireAuth(req, res, true); if (!s) return;
    try { const out = await runScript("backup-ets2.sh"); audit(s.user, "backup_create", out); return send(res, 201, { ok: true, name: out, backups: listBackups() }); } catch(e) { return send(res, 500, { error: e.message }); }
  }
  const backupMatch = url.pathname.match(/^\/api\/backups\/([^/]+)(?:\/(download|restore))?$/);
  if (backupMatch) {
    const s = requireAuth(req, res, req.method !== "GET"); if (!s) return; const name = safeBackupName(decodeURIComponent(backupMatch[1])); if (!name) return send(res, 400, { error: "Ungültiger Backupname" }); const file = path.join(BACKUPS, name);
    if (!existsSync(file)) return send(res, 404, { error: "Backup nicht gefunden" });
    if (req.method === "GET" && backupMatch[2] === "download") { res.writeHead(200, { "Content-Type": "application/gzip", "Content-Disposition": `attachment; filename="${name}"`, "Content-Length": statSync(file).size }); return createReadStream(file).pipe(res); }
    if (req.method === "DELETE") { unlinkSync(file); audit(s.user, "backup_delete", name); return send(res, 200, { ok: true }); }
    if (req.method === "POST" && backupMatch[2] === "restore") { if (running().running) return send(res, 409, { error: "Server vor Wiederherstellung stoppen" }); try { await runScript("restore-ets2.sh", [file]); audit(s.user, "backup_restore", name); return send(res, 200, { ok: true }); } catch(e) { return send(res, 500, { error: e.message }); } }
  }
  return send(res, 404, { error: "API-Endpunkt nicht gefunden" });
}

async function apiV2(req, res, url) {
  const game = gameFrom(url.searchParams.get("game"));
  if (["/api/bootstrap", "/api/login", "/api/logout", "/api/me", "/api/audit"].includes(url.pathname)||url.pathname.startsWith("/api/client/")||url.pathname.startsWith("/api/admin/drivers")) return api(req, res, url);
  if (url.pathname === "/api/overview" && req.method === "GET") {
    const s = requireAuth(req, res); if (!s) return; const config = getConfig(game), state = running(game), log = tail(serverLog(game), 300), players = livePlayers(game);
    const searchId = log.match(/search id[^\d]*(\d+)/i)?.[1] || "–";
    return send(res, 200, { ...state, game: { id:game.id, label:game.label, short:game.short, appId:game.appId, ports:game.ports }, games:Object.values(games).map(g=>({id:g.id,label:g.label,short:g.short})), installed:existsSync(path.join(game.server, `bin/linux_x64/${game.binary}`)), installing:installs.has(game.id), config:publicConfig(config), packages:packageState(game), metrics:systemMetrics(), searchId, players });
  }
  if (url.pathname === "/api/config" && req.method === "GET") { const s=requireAuth(req,res); if(!s)return; return send(res,200,publicConfig(getConfig(game))); }
  if (url.pathname === "/api/config" && req.method === "PUT") {
    const s=requireAuth(req,res,true); if(!s)return; const input=await body(req), old=getConfig(game);
    const next={...old,lobby_name:safeText(input.lobby_name,63),description:safeText(input.description,63),welcome_message:safeText(input.welcome_message,127),password:input.password?safeText(input.password,63):old.password,server_logon_token:input.server_logon_token?safeText(input.server_logon_token,128):old.server_logon_token,server_name:safeText(input.server_name,63),max_players:Math.min(128,Math.max(1,Number(input.max_players)||8)),backup_retention:Math.min(50,Math.max(1,Number(input.backup_retention)||10))};
    atomicJson(game.config,next); writeServerConfig(game,next); audit(s.user,`${game.id}_config_update`,next.lobby_name); return send(res,200,publicConfig(next));
  }
  if (url.pathname === "/api/logs" && req.method === "GET") { const s=requireAuth(req,res); if(!s)return; const kind=url.searchParams.get("kind"); return send(res,200,{text:tail(kind==="install"?game.installLog:serverLog(game),Math.min(1000,Number(url.searchParams.get("limit"))||300))}); }
  if (url.pathname === "/api/server/install" && req.method === "POST") {
    const s=requireAuth(req,res,true); if(!s)return; if(installs.has(game.id))return send(res,409,{error:"Installation läuft bereits"}); audit(s.user,`${game.id}_install_start`); writeFileSync(game.installLog,`${new Date().toISOString()} ${game.label} Installation gestartet\n`,{flag:"a"});
    const job=runScript(game,"install-ets2.sh").then(out=>{writeFileSync(game.installLog,`${out}\nInstallation abgeschlossen.\n`,{flag:"a"});audit(s.user,`${game.id}_install_complete`);}).catch(e=>{writeFileSync(game.installLog,`FEHLER: ${e.message}\n`,{flag:"a"});audit(s.user,`${game.id}_install_failed`,e.message);}).finally(()=>installs.delete(game.id)); installs.set(game.id,job); return send(res,202,{ok:true,message:`${game.short}-Installation gestartet`});
  }
  if (url.pathname === "/api/server/action" && req.method === "POST") {
    const s=requireAuth(req,res,true); if(!s)return; const input=await body(req),action=input.action; if(!["start","stop","restart","update"].includes(action))return send(res,400,{error:"Unbekannte Aktion"}); if(["start","restart"].includes(action)&&packageState(game).some(f=>!f.present))return send(res,409,{error:`${game.short}: server_packages.sii und server_packages.dat müssen zuerst hochgeladen werden`});
    try{const out=action==="update"?await runScript(game,"install-ets2.sh"):await runScript(game,`${action}-ets2.sh`);audit(s.user,`${game.id}_server_${action}`);return send(res,200,{ok:true,message:out||`${game.short}: ${action}`});}catch(e){audit(s.user,`${game.id}_server_${action}_failed`,e.message);return send(res,500,{error:e.message});}
  }
  if (url.pathname === "/api/packages" && req.method === "POST") { const s=requireAuth(req,res,true);if(!s)return;const input=await body(req,55_000_000),name=String(input.name||"");if(!["server_packages.sii","server_packages.dat"].includes(name))return send(res,400,{error:"Dateiname nicht erlaubt"});const buffer=Buffer.from(String(input.contentBase64||""),"base64");if(!buffer.length||buffer.length>40_000_000)return send(res,400,{error:"Datei leer oder zu groß (max. 40 MB)"});writeFileSync(path.join(game.home,name),buffer,{mode:0o600});audit(s.user,`${game.id}_package_upload`,`${name} ${buffer.length}B`);return send(res,201,{ok:true}); }
  if (url.pathname === "/api/backups" && req.method === "GET") {const s=requireAuth(req,res);if(!s)return;return send(res,200,{backups:listBackups(game)});}
  if (url.pathname === "/api/backups" && req.method === "POST") {const s=requireAuth(req,res,true);if(!s)return;try{const out=await runScript(game,"backup-ets2.sh");audit(s.user,`${game.id}_backup_create`,out);return send(res,201,{ok:true,name:out,backups:listBackups(game)});}catch(e){return send(res,500,{error:e.message});}}
  const backupMatch=url.pathname.match(/^\/api\/backups\/([^/]+)(?:\/(download|restore))?$/); if(backupMatch){const s=requireAuth(req,res,req.method!=="GET");if(!s)return;const name=safeBackupName(decodeURIComponent(backupMatch[1]));if(!name||!name.startsWith(`${game.id}-`))return send(res,400,{error:"Ungültiger Backupname"});const file=path.join(BACKUPS,name);if(!existsSync(file))return send(res,404,{error:"Backup nicht gefunden"});if(req.method==="GET"&&backupMatch[2]==="download"){res.writeHead(200,{"Content-Type":"application/gzip","Content-Disposition":`attachment; filename="${name}"`,"Content-Length":statSync(file).size});return createReadStream(file).pipe(res);}if(req.method==="DELETE"){unlinkSync(file);audit(s.user,`${game.id}_backup_delete`,name);return send(res,200,{ok:true});}if(req.method==="POST"&&backupMatch[2]==="restore"){if(running(game).running)return send(res,409,{error:"Server vor Wiederherstellung stoppen"});try{await runScript(game,"restore-ets2.sh",[file]);audit(s.user,`${game.id}_backup_restore`,name);return send(res,200,{ok:true});}catch(e){return send(res,500,{error:e.message});}}}
  if(url.pathname==="/api/telemetry/token"&&req.method==="GET"){const s=requireAuth(req,res);if(!s)return;return send(res,200,{token:getConfig(game).telemetry_token,endpoint:`/api/telemetry/${game.id}`});}
  if(url.pathname==="/api/telemetry/token"&&req.method==="POST"){const s=requireAuth(req,res,true);if(!s)return;const config=getConfig(game);config.telemetry_token=crypto.randomBytes(24).toString("base64url");atomicJson(game.config,config);telemetry.get(game.id).clear();audit(s.user,`${game.id}_telemetry_token_regenerated`);return send(res,200,{token:config.telemetry_token,endpoint:`/api/telemetry/${game.id}`});}
  const telemetryMatch=url.pathname.match(/^\/api\/telemetry\/(ets2|ats)$/); if(telemetryMatch&&req.method==="POST"){const target=games[telemetryMatch[1]],expected=getConfig(target).telemetry_token,supplied=String(req.headers.authorization||"").replace(/^Bearer\s+/i,"");if(!supplied||supplied.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(expected)))return send(res,401,{error:"Telemetrie-Token ungültig"});const input=await body(req),name=safeText(input.name||input.driver,50),steamId=safeText(input.steamId||input.steam_id,24);if(!name)return send(res,400,{error:"Fahrername fehlt"});const id=steamId||name.toLowerCase(),num=v=>Number.isFinite(Number(v))?Number(v):null;telemetry.get(target.id).set(id,{name,steamId:steamId||"–",ping:Math.max(0,Math.min(9999,num(input.ping)??0)),city:safeText(input.city,60)||"–",company:safeText(input.company,60)||"–",x:num(input.x),y:num(input.y),z:num(input.z),heading:num(input.heading),speed:num(input.speed),source:"Live-Telemetrie",updatedAt:Date.now()});return send(res,202,{ok:true});}
  return send(res,404,{error:"API-Endpunkt nicht gefunden"});
}

function staticFile(req, res, url) {
  const requested = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
  const file = path.resolve(PUBLIC, requested);
  if (!file.startsWith(path.resolve(PUBLIC)) || !existsSync(file) || statSync(file).isDirectory()) return send(res, 404, "Nicht gefunden");
  const ext = path.extname(file); const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
  const cacheControl = [".html", ".js", ".css"].includes(ext) ? "no-store, max-age=0" : "public, max-age=3600";
  res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream", "Cache-Control": cacheControl }); createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  security(res); const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try { if (url.pathname.startsWith("/api/")) await apiV2(req, res, url); else staticFile(req, res, url); }
  catch (e) { console.error(e); send(res, e.message === "PAYLOAD_TOO_LARGE" ? 413 : 400, { error: e.message === "PAYLOAD_TOO_LARGE" ? "Anfrage zu groß" : "Ungültige Anfrage" }); }
});
server.listen(PORT, "0.0.0.0", () => console.log(`ETS2 Server Control läuft auf http://0.0.0.0:${PORT}`));
setInterval(() => { const now = Date.now(); for (const [k,v] of sessions) if (v.expires < now) sessions.delete(k); }, 60_000).unref();
