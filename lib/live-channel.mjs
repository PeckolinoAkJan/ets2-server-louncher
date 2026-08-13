import crypto from 'node:crypto';

export async function attachLiveChannel(server,{authenticate,snapshot}){
  if(process.env.ENABLE_WEBSOCKET!=='1')return{enabled:false,close:async()=>{}};
  const {WebSocketServer}=await import('ws');
  const wss=new WebSocketServer({noServer:true,maxPayload:64*1024,perMessageDeflate:false});
  server.on('upgrade',(request,socket,head)=>{
    try{
      const url=new URL(request.url,'http://localhost');
      if(url.pathname!=='/api/client/live')return socket.destroy();
      const protocols=String(request.headers['sec-websocket-protocol']||'').split(',').map(x=>x.trim());
      const encoded=protocols.find(x=>x.startsWith('vtc-v1.'))?.slice(7);
      if(!encoded)return socket.destroy();
      const token=Buffer.from(encoded,'base64url').toString('utf8'),account=authenticate(token);
      const game=['ets2','ats'].includes(url.searchParams.get('game'))?url.searchParams.get('game'):'ets2';
      if(!account)return socket.destroy();
      request.vtc={account,game};wss.handleUpgrade(request,socket,head,ws=>wss.emit('connection',ws,request));
    }catch{socket.destroy()}
  });
  wss.on('connection',(ws,request)=>{
    const connectionId=crypto.randomUUID();
    ws.vtcGame=request.vtc.game;
    ws.send(JSON.stringify({type:'welcome',connectionId,game:request.vtc.game,account:{displayName:request.vtc.account.displayName,steamId:request.vtc.account.steamId}}));
    ws.on('message',raw=>{try{const msg=JSON.parse(raw);if(msg.type==='ping')ws.send(JSON.stringify({type:'pong',at:Date.now()}));}catch{}});
  });
  const timer=setInterval(()=>{for(const ws of wss.clients)if(ws.readyState===ws.OPEN)ws.send(JSON.stringify({type:'players',at:Date.now(),data:snapshot(ws.vtcGame||'ets2')}));},1000);
  timer.unref();
  return{enabled:true,close:async()=>{clearInterval(timer);for(const ws of wss.clients)ws.close(1001,'server shutdown');await new Promise(resolve=>wss.close(resolve))}};
}
