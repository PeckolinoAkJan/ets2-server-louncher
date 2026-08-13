export function convoySearchTerm(searchId){
  const value=String(searchId??'').trim();
  const match=/^(\d{17,20})(?:\/(\d{1,3}))?$/.exec(value);
  if(!match)throw new Error('Session Search ID ist ungültig');
  return match[1];
}

export function convoyJoinRequest(game,server){
  if(!['ets2','ats'].includes(game))throw new Error('Spiel wird vom Convoy-Adapter nicht unterstützt');
  if(!server?.id||!server?.searchId)throw new Error('Server oder Session Search ID fehlt');
  return{
    schemaVersion:1,
    game,
    serverId:String(server.id),
    serverName:String(server.name||server.id),
    fullSearchId:String(server.searchId).trim(),
    searchTerm:convoySearchTerm(server.searchId),
    requestedAt:new Date().toISOString()
  };
}
