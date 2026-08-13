import { existsSync, readFileSync } from 'node:fs';

export function parseGameLogStatus(text,expectedSlot){
  const loads=[...text.matchAll(/Loading save\. Type:\s*(\d+),\s*slot:\s*(\d+),\s*path:.*?\/save\/([^/]+)\/game\.sii/g)];
  const last=loads.at(-1);const loaded=last?{type:Number(last[1]),slot:Number(last[2]),folder:last[3]}:null;
  const expected=String(expectedSlot||'');const expectedLoaded=Boolean(loaded&&loaded.folder===expected);
  const lines=text.split(/\r?\n/),loadLine=last?text.slice(0,last.index).split(/\r?\n/).length:0;
  const afterLoad=loadLine?lines.slice(loadLine):[];
  const adapterErrors=afterLoad.filter(line=>/<ERROR>/.test(line)&&/(job_offer_data|cargo\.|trailer|company\.volatile)/i.test(line));
  return{loaded,expectedSlot:expected,expectedLoaded,adapterErrors:adapterErrors.slice(-30)};
}

export function readGameLogStatus(file,expectedSlot){if(!existsSync(file))return{loaded:null,expectedSlot:String(expectedSlot),expectedLoaded:false,adapterErrors:[]};return parseGameLogStatus(readFileSync(file,'utf8'),expectedSlot);}
export function currentLaunchLog(text,offset){const start=Number(offset)||0;return text.slice(start<=text.length?start:0);}

export function parseConnectionStatus(text,server,elapsedMs=0){
  if(/\[MP\].*connected,\s*client_id\s*=/i.test(text)||/\[MP\]\s+Game server joined\./i.test(text))return{status:'connected',message:`Mit ${server.name} verbunden.`,server};
  if(/\[MP\].*(failed|refused|invalid|disconnected|closure requested)/i.test(text))return{status:'failed',message:`Serverbeitritt fehlgeschlagen. ${text.split(/\r?\n/).filter(line=>/\[MP\].*(failed|refused|invalid|disconnected|closure requested)/i.test(line)).at(-1)?.trim()||''}`,server};
  if(/Loading save\.|Profile selected|g_start_in_truck/i.test(text)){
    const searchTerm=String(server?.searchId||'').split('/')[0];
    if(elapsedMs>180000)return{status:'manual_action_required',message:`Automatischer Convoy-Beitritt wurde nicht bestätigt. Öffne Convoy, suche ${searchTerm} und tritt ${server.name} bei.`,server,searchTerm};
    return{status:'profile-loaded',message:`Fahrerprofil geladen. Convoy-Beitritt zu ${server.name} wird vorbereitet (Suche: ${searchTerm}).`,server,searchTerm};
  }
  return{status:'profile',message:'Spiel gestartet. Fahrerprofil auswählen; anschließend erfolgt der Beitritt über den offiziellen Convoy-Browser.',server};
}
