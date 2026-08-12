export function steamLaunchArguments(game,server){
  if(!server?.searchId)throw new Error('Session Search ID fehlt');
  const searchId=String(server.searchId).trim();
  if(!/^\d+(?:\/\d+)?$/.test(searchId))throw new Error('Session Search ID ist ungültig');
  const steamLobbyId=searchId.split('/')[0];
  return['-silent','-applaunch',String(game.steamAppId),'+connect_lobby',steamLobbyId];
}
