import crypto from "node:crypto";

export const STATES = Object.freeze({
  RESERVED:"reserved", NAVIGATING:"navigating_to_company", READY:"ready_at_company",
  SPAWNING:"spawning_provided_trailer", LOADING_OWNED:"loading_owned_trailer",
  ACTIVE:"active", COMPLETED:"completed", FAILED:"failed"
});

export class IntegrationState {
  constructor(){this.active=null;this.events=[];this.plugin=null;}
  connectPlugin(info){if(!['ets2','ats'].includes(info.game))throw new Error('Ungültiges Plugin-Spiel');this.plugin={...info,connectedAt:new Date().toISOString(),lastSeen:Date.now()};this.event('plugin_connected',info);return this.snapshot();}
  heartbeat(data={}){
    if(!this.plugin){
      if(!['ets2','ats'].includes(data.game))throw new Error('Ingame-Plugin ist nicht verbunden');
      return this.connectPlugin(data);
    }
    this.plugin={...this.plugin,...data,lastSeen:Date.now()};return this.snapshot();
  }
  disconnect(data={}){if(this.plugin)this.event('plugin_disconnected',{...data,game:this.plugin.game});this.plugin=null;return this.snapshot();}
  reserve(offer){this.active={...offer,nonce:crypto.randomBytes(16).toString('hex'),state:STATES.RESERVED,updatedAt:new Date().toISOString(),error:null};this.event('offer_reserved',{id:offer.id});return this.snapshot();}
  command(telemetry={}){if(!this.active)return{type:'idle'};const a=this.active;if(!this.plugin||Date.now()-this.plugin.lastSeen>5000)return{type:'wait_plugin',offerId:a.id};if(this.plugin.game!==a.game)return{type:'wrong_game',expected:a.game,actual:this.plugin.game};
    if(a.state===STATES.RESERVED){if(telemetry.distanceToSourceMeters>400||a.navigateOnly){a.state=STATES.NAVIGATING;this.event('navigation_requested',{offerId:a.id});return{type:'set_navigation',offerId:a.id,company:a.source.company.id,city:a.source.city.id};}a.state=STATES.READY;}
    if(a.state===STATES.NAVIGATING){if(telemetry.distanceToSourceMeters<=400){a.state=STATES.READY;this.event('arrived_at_company',{offerId:a.id});}else return{type:'set_navigation',offerId:a.id,company:a.source.company.id,city:a.source.city.id};}
    if(a.state===STATES.READY){if(a.trailer.mode==='owned'){if(!telemetry.ownedTrailerAttached)return{type:'require_owned_trailer',offerId:a.id,trailer:a.trailer.id};if(Array.isArray(telemetry.ownedTrailerBodyTypes)&&!telemetry.ownedTrailerBodyTypes.includes(a.trailer.id))return{type:'owned_trailer_incompatible',offerId:a.id};a.state=STATES.LOADING_OWNED;return{type:'create_owned_trailer_job',offerId:a.id,nonce:a.nonce,cargo:a.cargo.id,sourceCompany:a.source.company.id,destinationCompany:a.destination.company.id,urgency:a.urgency};}
      a.state=STATES.SPAWNING;return{type:'create_freight_market_job',offerId:a.id,nonce:a.nonce,cargo:a.cargo.id,trailer:a.trailer.id,sourceCompany:a.source.company.id,destinationCompany:a.destination.company.id,urgency:a.urgency,spawnAtCompany:true};}
    return{type:'await_result',offerId:a.id,state:a.state};
  }
  result(input){if(!this.active||input.offerId!==this.active.id)throw new Error('Ergebnis gehört nicht zum aktiven Auftrag');if(input.ok){this.active.state=STATES.ACTIVE;this.active.gameJobId=String(input.gameJobId||'');this.event('job_activated',input);}else{this.active.state=STATES.FAILED;this.active.error=String(input.error||'Unbekannter Integrationsfehler');this.event('job_failed',input);}this.active.updatedAt=new Date().toISOString();return this.snapshot();}
  complete(input={}){if(!this.active)throw new Error('Kein aktiver Auftrag');this.active.state=STATES.COMPLETED;this.active.result=input;this.event('job_completed',input);return this.snapshot();}
  event(type,data){this.events.push({type,data,at:new Date().toISOString()});if(this.events.length>200)this.events.shift();}
  pluginReady(game,maximumAgeMs=5000){return Boolean(this.plugin&&this.plugin.game===game&&Date.now()-this.plugin.lastSeen<=maximumAgeMs);}
  snapshot(){return{plugin:this.plugin,pluginReady:Boolean(this.plugin&&Date.now()-this.plugin.lastSeen<=5000),active:this.active,events:this.events.slice(-30)};}
}
