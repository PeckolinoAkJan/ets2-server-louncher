import http from "node:http";
import { readFileSync, existsSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawn } from "node:child_process";
import { loadCatalog, compatibleCargo, buildOffer } from "./lib/catalog.mjs";
import { detectGames } from "./lib/game-detection.mjs";
import { createSteamLoginUrl, newAuthState } from "./lib/auth.mjs";
import { TelemetryService } from "./lib/telemetry-service.mjs";
import { IntegrationState } from "./lib/integration-state.mjs";
import { SaveJobService } from "./lib/save-job-service.mjs";
import { currentLaunchLog, parseConnectionStatus, readGameLogStatus } from "./lib/game-log-status.mjs";
import { steamLaunchArguments } from "./lib/game-launch.mjs";
import { MultiplayerClient } from "./lib/multiplayer-client.mjs";
import { convoyJoinRequest } from "./lib/convoy-join.mjs";

const parseJsonFile=file=>JSON.parse(readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const ROOT=path.dirname(fileURLToPath(import.meta.url)),configFile=path.join(ROOT,'config.json'),config=existsSync(configFile)?parseJsonFile(configFile):parseJsonFile(path.join(ROOT,'config.example.json'));
const RUNTIME_VERSION='0.10.1-dev';
const PORT=Number(process.env.VTC_LOCAL_PORT||config.localPort||27111),sessions=new Map(),offers=[],integration=new IntegrationState(),launches=new Map();let multiplayerClient=null,recoveryPromise=null;
const enabledGames=Array.isArray(config.enabledGames)&&config.enabledGames.length?config.enabledGames:['ets2'];
const authFile=path.join(ROOT,'auth.json'),storedAuth=existsSync(authFile)?parseJsonFile(authFile):null;if(storedAuth?.account&&storedAuth?.accessToken)sessions.set('local',storedAuth);
const testManifestFile=path.join(ROOT,'active-test-save.json');
const activeLaunchFile=path.join(ROOT,'active-launch.json');
if(existsSync(activeLaunchFile)){try{const saved=parseJsonFile(activeLaunchFile);if(saved?.game&&saved?.server)launches.set(saved.game,saved);}catch{}}
const saveJobs=new SaveJobService(ROOT);
function activeTestSave(){
  if(!existsSync(testManifestFile))return null;
  try{return JSON.parse(readFileSync(testManifestFile,'utf8').replace(/^\uFEFF/,''));}catch{return null;}
}
function ingameTestStatus(){const manifest=activeTestSave();if(!manifest)return{loaded:null,expectedLoaded:false,adapterErrors:[]};const gameRoot=manifest.game==='ats'?'American Truck Simulator':'Euro Truck Simulator 2';const log=path.join(process.env.USERPROFILE||'', 'Documents',gameRoot,'game.log.txt');return readGameLogStatus(log,path.basename(manifest.target));}
function gameLog(game){return path.join(process.env.USERPROFILE||'', 'Documents',game==='ats'?'American Truck Simulator':'Euro Truck Simulator 2','game.log.txt');}
function gameProcessName(game){return game==='ats'?'amtrucks.exe':'eurotrucks2.exe';}
function isGameRunning(game){try{return new RegExp(gameProcessName(game).replace('.','\\.'),'i').test(execFileSync('tasklist.exe',['/FI',`IMAGENAME eq ${gameProcessName(game)}`,'/FO','CSV','/NH'],{encoding:'utf8',windowsHide:true}));}catch{return false;}}
function steamExecutable(game){const normalized=path.resolve(game.executable),marker=`${path.sep}steamapps${path.sep}`,index=normalized.toLowerCase().indexOf(marker);if(index<0)return null;const steam=path.join(normalized.slice(0,index),'steam.exe');return existsSync(steam)?steam:null;}
async function waitForGame(game,timeout=30000){const end=Date.now()+timeout;while(Date.now()<end){if(isGameRunning(game.id))return true;await new Promise(resolve=>setTimeout(resolve,500));}return false;}
export async function currentServer(selected,auth,fetchImpl=fetch){const response=await fetchImpl(`${config.panelUrl.replace(/\/$/,'')}/api/client/servers`,{headers:{authorization:`Bearer ${auth.accessToken}`}}),data=await response.json();if(!response.ok)throw new Error(data.error||'Serverstatus konnte nicht geladen werden');return data.servers.find(server=>server.id===selected.id)||selected;}
function connectionStatus(game){
  if(multiplayerClient?.game===game&&multiplayerClient.session){
    const snapshot=multiplayerClient.snapshot(),server=launches.get(game)?.server;
    const launch=launches.get(game),file=gameLog(game);if(!launch||!existsSync(file))return{status:'joining_convoy',message:'VTC-Kanal bereit. Warte auf den Convoy-Beitritt �?�',server,multiplayer:snapshot};
    const logText=readFileSync(file,'utf8'),offset=Number(launch.logOffset)||0;
    // ETS2 recreates game.log.txt at startup. A byte offset captured from the
    // previous run may be beyond the new log and must not hide live MP lines.
    const convoy=parseConnectionStatus(currentLaunchLog(logText,offset),launch.server,Date.now()-launch.startedAt);
    if(convoy.status==='failed')return{...convoy,multiplayer:snapshot};
    if(convoy.status!=='connected')return{...convoy,multiplayer:snapshot};
    if(!integration.pluginReady(game))return{status:'connected',message:`Mit ${launch.server.name} verbunden. VTC-Telemetrie wartet auf das Spielmodul.`,server,multiplayer:snapshot};
    if(!snapshot.lastSyncAt||Date.now()-snapshot.lastSyncAt>5000)return{status:'connected',message:`Mit ${launch.server.name} verbunden. VTC-Fahrerdaten werden synchronisiert.`,server,multiplayer:snapshot};
    return{status:'connected',message:`Mit ${launch.server.name} verbunden · ${snapshot.players.length+1} VTC-Fahrer synchronisiert`,server,multiplayer:snapshot};
  }
  const launch=launches.get(game);if(!launch)return{status:'idle',message:'Noch kein Serverbeitritt gestartet.'};
  const file=gameLog(game);if(!existsSync(file))return{status:'starting',message:'Spiel wird gestartet �?�',server:launch.server};
  const logText=readFileSync(file,'utf8'),offset=Number(launch.logOffset)||0;const text=currentLaunchLog(logText,offset);return parseConnectionStatus(text,launch.server,Date.now()-launch.startedAt);
}
let telemetryService=null;
function telemetryStatus(){return{configured:Boolean(sessions.get('local')?.accessToken),running:Boolean(telemetryService?.timer),lastError:telemetryService?.lastError||null};}
function startTelemetry(game='ets2') { const auth=sessions.get('local'),account=auth?.account;if(!config.telemetryAutoStart||!auth?.accessToken||!account)return false;telemetryService?.stop();telemetryService=new TelemetryService({panelUrl:config.panelUrl,token:auth.accessToken,game,driverName:account.displayName,steamId:account.steamId,clientAuth:true});telemetryService.start();return true; }
function prepareConvoyJoin(game,server){
  const request=convoyJoinRequest(game,server),requestFile=path.join(ROOT,'runtime','convoy-join-request.json');
  writeFileSync(requestFile,JSON.stringify(request,null,2));
  return{...request,requestFile,status:'prepared'};
}
async function recoverMultiplayer(game){
  if(multiplayerClient?.game===game&&multiplayerClient.session)return multiplayerClient;
  if(recoveryPromise)return recoveryPromise;
  recoveryPromise=(async()=>{const auth=sessions.get('local');if(!auth?.accessToken)return null;let launch=launches.get(game),selected=launch?.server||(config.servers||[]).find(server=>server.game===game);if(!selected)return null;const live=await currentServer(selected,auth);if(!live.running)return null;const client=new MultiplayerClient({panelUrl:config.panelUrl,accessToken:auth.accessToken,game,serverId:live.id,clientVersion:RUNTIME_VERSION,pluginVersion:integration.plugin?.pluginVersion||'not-connected'});await client.join(config.preferredMapProfile||'standard');multiplayerClient=client;launch={game,server:live,startedAt:launch?.startedAt||Date.now(),logOffset:launch?.logOffset||0,searchId:live.searchId};launches.set(game,launch);writeFileSync(activeLaunchFile,JSON.stringify(launch,null,2));return client;})().finally(()=>{recoveryPromise=null;});
  return recoveryPromise;
}
function send(res,status,data,type='application/json; charset=utf-8'){const body=type.startsWith('application/json')?JSON.stringify(data):data;res.writeHead(status,{'content-type':type,'cache-control':'no-store','content-length':Buffer.byteLength(body)});res.end(body);}
async function body(req){let value='';for await(const c of req){value+=c;if(value.length>1e6)throw new Error('Anfrage zu gro�Y');}return value?JSON.parse(value):{};}
function staticFile(res,name){const file=path.resolve(ROOT,'ui',name);if(!file.startsWith(path.resolve(ROOT,'ui'))||!existsSync(file))return send(res,404,'Nicht gefunden','text/plain');const ext=path.extname(file);send(res,200,readFileSync(file),ext==='.html'?'text/html; charset=utf-8':ext==='.css'?'text/css; charset=utf-8':'text/javascript; charset=utf-8');}

const server=http.createServer(async(req,res)=>{const url=new URL(req.url,`http://${req.headers.host}`);try{
  if(url.pathname==='/api/status'){return send(res,200,{runtimeVersion:RUNTIME_VERSION,games:detectGames().filter(game=>enabledGames.includes(game.id)),servers:(config.servers||[]).filter(server=>enabledGames.includes(server.game)),telemetry:telemetryStatus(),multiplayer:multiplayerClient?.snapshot()||{connected:false,players:[]},integration:integration.snapshot(),testSave:activeTestSave(),config:{panelUrl:config.panelUrl,preferredMapProfile:config.preferredMapProfile,dispatcherHotkey:config.dispatcherHotkey,telemetryAutoStart:config.telemetryAutoStart,enabledGames},account:sessions.get('local')?.account||null,offers:offers.slice(-10)});}
  if(url.pathname==='/api/runtime/shutdown'&&req.method==='POST'){send(res,202,{ok:true});setTimeout(()=>server.close(()=>process.exit(0)),50);return;}
  if(url.pathname==='/api/auth/steam'&&req.method==='POST'){const response=await fetch(`${config.panelUrl.replace(/\/$/,'')}/api/client/device/start`,{method:'POST'}),data=await response.json();if(!response.ok)throw new Error(data.error||'Geräteanmeldung konnte nicht gestartet werden');sessions.set('device',{...data,createdAt:Date.now()});return send(res,200,{url:data.verificationUri,verificationUri:data.verificationUri,userCode:data.userCode,expiresIn:data.expiresIn});}
  if(url.pathname==='/api/client/register'&&req.method==='POST'){const input=await body(req),response=await fetch(`${config.panelUrl.replace(/\/$/,'')}/api/client/register`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({displayName:input.displayName})}),data=await response.json();if(!response.ok)throw new Error(data.error||'Fahrerregistrierung konnte nicht gestartet werden');sessions.set('device',{...data,createdAt:Date.now()});return send(res,200,{verificationUri:data.verificationUri,userCode:data.userCode,expiresIn:data.expiresIn});}
  if(url.pathname==='/api/auth/poll'&&req.method==='POST'){const pending=sessions.get('device');if(!pending)return send(res,409,{error:'Keine Geräteanmeldung aktiv'});const response=await fetch(`${config.panelUrl.replace(/\/$/,'')}/api/client/device/token`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({deviceCode:pending.deviceCode})}),data=await response.json();if(response.status===202)return send(res,202,data);if(!response.ok)throw new Error(data.error||'Anmeldung fehlgeschlagen');const auth={accessToken:data.accessToken,account:data.account,expiresAt:Date.now()+data.expiresIn*1000};writeFileSync(authFile,JSON.stringify(auth,null,2),{mode:0o600});sessions.set('local',auth);sessions.delete('device');startTelemetry('ets2');return send(res,200,{ok:true,account:auth.account});}
  if(url.pathname==='/api/auth/logout'&&req.method==='POST'){sessions.delete('local');sessions.delete('device');rmSync(authFile,{force:true});telemetryService?.stop();return send(res,200,{ok:true});}
  if(url.pathname==='/api/dev/link'&&req.method==='POST'){if(process.env.VTC_DEV_AUTH!=='1')return send(res,404,{error:'Nicht gefunden'});const input=await body(req),auth={accessToken:'development-only',account:{steamId:String(input.steamId||'76561198000000000'),vtcAccountId:String(input.vtcAccountId||'local-vtc'),displayName:String(input.displayName||'VTC Fahrer')}};sessions.set('local',auth);return send(res,200,{ok:true,account:auth.account});}
  if(url.pathname==='/api/servers'){const game=url.searchParams.get('game')||'ets2';if(!enabledGames.includes(game))return send(res,404,{error:'Dieses Spiel ist in dieser Clientversion nicht freigegeben'});return send(res,200,{servers:(config.servers||[]).filter(server=>server.game===game)});}
  if(url.pathname==='/api/telemetry/start'&&req.method==='POST'){const input=await body(req),started=startTelemetry(input.game);return send(res,started?200:409,started?{ok:true,telemetry:telemetryStatus()}:{error:'Steam-/VTC-Konto oder Telemetrie-Token fehlt'});}
  if(url.pathname==='/api/catalog'){const game=url.searchParams.get('game')||'ets2';if(!enabledGames.includes(game))return send(res,404,{error:'Dieses Spiel ist in dieser Clientversion nicht freigegeben'});const catalog=await loadCatalog(game,url.searchParams.get('profile')||'standard');return send(res,200,catalog);}
  if(url.pathname==='/api/catalog/compatible'){const catalog=await loadCatalog(url.searchParams.get('game')||'ets2',url.searchParams.get('profile')||'standard');return send(res,200,{cargo:compatibleCargo(catalog,url.searchParams.get('sourceCompany'),url.searchParams.get('destinationCompany'))});}
  if(url.pathname==='/api/dispatch'&&req.method==='POST'){const input=await body(req),catalog=await loadCatalog(input.game,input.mapProfile),offer=buildOffer(catalog,input);offers.push(offer);integration.reserve(offer);writeFileSync(path.join(ROOT,'last-offer.json'),JSON.stringify(offer,null,2));return send(res,201,{ok:true,offer,integration:{status:'reserved',message:'Auftrag geprüft und für das Ingame-Plugin reserviert.'}});}
  if(url.pathname==='/api/integration/status')return send(res,200,integration.snapshot());
  if(url.pathname==='/api/test-save/status')return send(res,200,{testSave:activeTestSave(),ingame:ingameTestStatus()});
  if(url.pathname==='/api/real-dispatch/setup'&&req.method==='POST'){if(!sessions.get('local')?.account)return send(res,401,{error:'Steam- und VTC-Anmeldung erforderlich'});return send(res,201,saveJobs.prepare(await body(req)));}
  if(url.pathname==='/api/real-dispatch/catalog'){if(!sessions.get('local')?.account)return send(res,401,{error:'Steam- und VTC-Anmeldung erforderlich'});return send(res,200,saveJobs.catalog());}
  if(url.pathname==='/api/real-dispatch/apply'&&req.method==='POST'){if(!sessions.get('local')?.account)return send(res,401,{error:'Steam- und VTC-Anmeldung erforderlich'});return send(res,200,saveJobs.apply(await body(req)));}
  if(url.pathname==='/api/real-dispatch/load-test-slot'&&req.method==='POST'){
    const manifest=activeTestSave();if(!manifest)return send(res,409,{error:'VTC-Testslot ist nicht vorbereitet'});
    const slot=Number(path.basename(manifest.target));if(!Number.isInteger(slot)||slot<1||slot>99)return send(res,409,{error:'VTC-Testziel ist kein gültiger manueller Slot'});
    const script=path.join(ROOT,'native-plugin','overlay-host','load-test-slot.ps1');
    const resultFile=path.join(ROOT,'runtime','load-test-slot.json');rmSync(resultFile,{force:true});
    const child=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',script,'-Slot',String(slot),'-ResultFile',resultFile],{detached:true,stdio:'ignore',windowsHide:true});child.unref();
    return send(res,202,{ok:true,slot,message:`ETS2 lädt jetzt den VTC-Testslot ${slot}`});
  }
  if(url.pathname==='/api/real-dispatch/load-status'){
    const file=path.join(ROOT,'runtime','load-test-slot.json');if(!existsSync(file))return send(res,200,{status:'pending'});
    try{return send(res,200,JSON.parse(readFileSync(file,'utf8').replace(/^\uFEFF/,'')));}catch{return send(res,500,{status:'error',message:'Ladeergebnis ist unlesbar.'});}
  }
  if(url.pathname==='/api/integration/hello'&&req.method==='POST'){const input=await body(req);return send(res,200,integration.connectPlugin(input));}
  if(url.pathname==='/api/integration/heartbeat'&&req.method==='POST'){const input=await body(req);return send(res,200,integration.heartbeat(input));}
  if(url.pathname==='/api/integration/disconnect'&&req.method==='POST'){return send(res,200,integration.disconnect(await body(req)));}
  if(url.pathname==='/api/integration/command'&&req.method==='POST'){
    const input=await body(req),telemetry=input.telemetry||{};integration.heartbeat(input.plugin||{});
    if(!multiplayerClient?.session)await recoverMultiplayer(input.plugin?.game).catch(()=>null);
    const command=integration.command(telemetry);let multiplayer=null;
    if(multiplayerClient?.session){try{multiplayer=await multiplayerClient.heartbeat(telemetry);}catch(error){multiplayer={error:error.message};}}
    return send(res,200,{...command,multiplayer});
  }
  if(url.pathname==='/api/integration/result'&&req.method==='POST'){return send(res,200,integration.result(await body(req)));}
  if(url.pathname==='/api/integration/complete'&&req.method==='POST'){return send(res,200,integration.complete(await body(req)));}
  if(url.pathname==='/api/game/connection-status'&&req.method==='GET')return send(res,200,connectionStatus(url.searchParams.get('game')||'ets2'));
  if(url.pathname==='/api/multiplayer/join'&&req.method==='POST'){const input=await body(req),auth=sessions.get('local');if(!auth?.accessToken)return send(res,401,{error:'Steam- und VTC-Anmeldung erforderlich'});multiplayerClient=new MultiplayerClient({panelUrl:config.panelUrl,accessToken:auth.accessToken,game:input.game,serverId:input.serverId,clientVersion:RUNTIME_VERSION,pluginVersion:integration.plugin?.pluginVersion||'not-connected'});try{return send(res,201,await multiplayerClient.join(input.mapProfile||config.preferredMapProfile||'standard'));}catch(error){if(error.status!==404)throw error;multiplayerClient=null;return send(res,200,{session:{mode:'scs-convoy',supplementalChannel:false},tickRate:0,timeoutMs:0});}}
  if(url.pathname==='/api/multiplayer/heartbeat'&&req.method==='POST'){if(!multiplayerClient)return send(res,409,{error:'Multiplayer-Sitzung fehlt'});return send(res,200,await multiplayerClient.heartbeat((await body(req)).state||{}));}
  if(url.pathname==='/api/multiplayer/players')return send(res,200,multiplayerClient?.snapshot()||{connected:false,players:[]});
  if(url.pathname==='/api/multiplayer/leave'&&req.method==='POST'){if(!multiplayerClient)return send(res,200,{ok:false});const result=await multiplayerClient.leave();multiplayerClient=null;return send(res,200,result);}
  if(url.pathname==='/api/game/launch'&&req.method==='POST'){
    const input=await body(req),game=detectGames().find(g=>g.id===input.game);if(!game?.installed)return send(res,409,{error:`${input.game.toUpperCase()} ist nicht gefunden worden`});
    const selected=(config.servers||[]).find(s=>s.id===input.serverId&&s.game===input.game);if(!selected)return send(res,404,{error:'Der ausgewählte VTC-Server wurde nicht gefunden'});
    if(isGameRunning(input.game))return send(res,409,{error:'Das Spiel läuft bereits. Bitte vollständig beenden und danach erneut über den VTC-Launcher starten.'});
    const auth=sessions.get('local');if(!auth?.accessToken)return send(res,401,{error:'Steam- und VTC-Anmeldung erforderlich'});
    const live=await currentServer(selected,auth);if(!live.running)return send(res,409,{error:`${live.name} ist momentan offline.`});if(!live.searchId)return send(res,409,{error:'Der Server ist online, hat aber noch keine aktuelle Session Search ID gemeldet.'});
    const log=gameLog(input.game),logOffset=existsSync(log)?readFileSync(log).length:0,steam=steamExecutable(game);if(!steam)return send(res,409,{error:'Steam.exe wurde zur Spielinstallation nicht gefunden.'});
    const args=steamLaunchArguments(game,live);
    spawn(steam,args,{detached:true,stdio:'ignore',windowsHide:true}).unref();if(!await waitForGame(game))return send(res,504,{error:'Steam hat das Spiel innerhalb von 30 Sekunden nicht gestartet. Bitte Steam öffnen und den Start erneut versuchen.'});
    const launchState={game:input.game,server:live,startedAt:Date.now(),logOffset,searchId:live.searchId};launches.set(input.game,launchState);writeFileSync(activeLaunchFile,JSON.stringify(launchState,null,2));startTelemetry(input.game);const convoyJoin=prepareConvoyJoin(input.game,live);
    return send(res,202,{ok:true,game:input.game,server:live,connection:'scs-convoy-manual',convoyJoin,searchId:live.searchId,message:`Spiel gestartet. Verwende dein normales Fahrerprofil. Öffne Convoy, suche ${convoyJoin.searchTerm} und tritt ${live.name} bei.`});
  }
  if(url.pathname==='/'||url.pathname==='/index.html')return staticFile(res,'index.html');if(url.pathname==='/ingame.html')return staticFile(res,'ingame.html');if(url.pathname==='/app.js')return staticFile(res,'app.js');if(url.pathname==='/style.css')return staticFile(res,'style.css');return send(res,404,{error:'Nicht gefunden'});
}catch(e){return send(res,400,{error:e.message});}});
server.listen(PORT,'127.0.0.1',()=>console.log(`VTC Truck Hub Client: http://127.0.0.1:${PORT}`));
