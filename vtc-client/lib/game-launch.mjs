export function steamLaunchArguments(game,server){
  if(!server?.searchId)throw new Error('Session Search ID fehlt');
  return['-silent','-applaunch',String(game.steamAppId),'+connect_lobby',String(server.searchId).split('/')[0]];
}
