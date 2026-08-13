export function steamLaunchArguments(game,server){
  if(!server?.searchId)throw new Error('Session Search ID fehlt');
  const searchId=String(server.searchId).trim();
  if(!/^\d+(?:\/\d+)?$/.test(searchId))throw new Error('Session Search ID ist ungültig');
  // A SCS Dedicated Server search id (for example 8556…/101) is not a
  // Steam lobby id. Passing its first part to +connect_lobby starts the game
  // but can never join the dedicated server. The actual SCS convoy join is
  // performed after startup through the in-game server browser adapter.
  return['-silent','-applaunch',String(game.steamAppId)];
}
