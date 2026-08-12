export function steamLaunchArguments(game,server){
  if(!server?.searchId)throw new Error('Session Search ID fehlt');
  const searchId=String(server.searchId).trim();
  if(!/^\d+(?:\/\d+)?$/.test(searchId))throw new Error('Session Search ID ist ungültig');
  return['-silent','-applaunch',String(game.steamAppId),'+connect_lobby',searchId];
}
