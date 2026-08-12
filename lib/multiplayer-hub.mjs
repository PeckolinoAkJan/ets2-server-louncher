import crypto from 'node:crypto';

const number=(value,min,max,fallback=0)=>{const parsed=Number(value);return Number.isFinite(parsed)?Math.min(max,Math.max(min,parsed)):fallback;};
const text=(value,max=80)=>String(value??'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,max);

export class MultiplayerHub {
  constructor({timeoutMs=15_000,now=()=>Date.now()}={}){this.timeoutMs=timeoutMs;this.now=now;this.sessions=new Map();}
  key(game,serverId,steamId){return `${game}:${serverId}:${steamId}`;}
  clean(){const threshold=this.now()-this.timeoutMs;for(const [key,value] of this.sessions)if(value.lastSeen<threshold)this.sessions.delete(key);}
  join(account,input={}){
    const game=input.game==='ats'?'ats':'ets2',serverId=text(input.serverId,80);if(!serverId)throw new Error('Server-ID fehlt');
    this.clean();const key=this.key(game,serverId,account.steamId),existing=this.sessions.get(key),session={
      sessionId:existing?.sessionId||crypto.randomUUID(),game,serverId,steamId:String(account.steamId),driverId:String(account.vtcAccountId),name:text(account.displayName,50),
      clientVersion:text(input.clientVersion,30),pluginVersion:text(input.pluginVersion,30),mapProfile:text(input.mapProfile||'standard',40),sequence:0,joinedAt:existing?.joinedAt||new Date(this.now()).toISOString(),lastSeen:this.now(),state:null
    };this.sessions.set(key,session);return this.publicSession(session,true);
  }
  heartbeat(account,input={}){
    const game=input.game==='ats'?'ats':'ets2',serverId=text(input.serverId,80),key=this.key(game,serverId,account.steamId),session=this.sessions.get(key);if(!session)throw new Error('Multiplayer-Sitzung fehlt');
    const sequence=Math.trunc(number(input.sequence,1,Number.MAX_SAFE_INTEGER,0));if(sequence<=session.sequence)throw new Error('Veralteter Multiplayer-Zustand');
    session.sequence=sequence;session.lastSeen=this.now();session.state=this.sanitizeState(input.state||{});return{self:this.publicSession(session,true),players:this.snapshot(game,serverId,account.steamId)};
  }
  sanitizeState(state){return{
    x:number(state.x,-10_000_000,10_000_000),y:number(state.y,-100_000,100_000),z:number(state.z,-10_000_000,10_000_000),heading:number(state.heading,-1000,1000),speed:number(state.speed,-300,300),
    trailerX:number(state.trailerX,-10_000_000,10_000_000),trailerY:number(state.trailerY,-100_000,100_000),trailerZ:number(state.trailerZ,-10_000_000,10_000_000),trailerHeading:number(state.trailerHeading,-1000,1000),
    truck:text(state.truck,100),trailer:text(state.trailer,100),city:text(state.city,60),company:text(state.company,60),lights:Boolean(state.lights),beacon:Boolean(state.beacon),horn:Boolean(state.horn)
  };}
  snapshot(game,serverId,exceptSteamId=''){this.clean();return[...this.sessions.values()].filter(s=>s.game===game&&s.serverId===serverId&&s.steamId!==String(exceptSteamId)).map(s=>this.publicSession(s));}
  leave(account,input={}){const game=input.game==='ats'?'ats':'ets2',serverId=text(input.serverId,80);return{ok:this.sessions.delete(this.key(game,serverId,account.steamId))};}
  publicSession(session,includePrivate=false){const value={sessionId:session.sessionId,game:session.game,serverId:session.serverId,steamId:session.steamId,name:session.name,mapProfile:session.mapProfile,sequence:session.sequence,joinedAt:session.joinedAt,lastSeen:session.lastSeen,state:session.state};if(includePrivate){value.clientVersion=session.clientVersion;value.pluginVersion=session.pluginVersion;}return value;}
  stats(){this.clean();return{sessions:this.sessions.size,ets2:[...this.sessions.values()].filter(s=>s.game==='ets2').length,ats:[...this.sessions.values()].filter(s=>s.game==='ats').length};}
}
