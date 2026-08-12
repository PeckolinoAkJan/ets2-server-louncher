import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const definitions = {
  ets2: { exe:"eurotrucks2.exe", steamAppId:"227300", documents:"Euro Truck Simulator 2" },
  ats: { exe:"amtrucks.exe", steamAppId:"270880", documents:"American Truck Simulator" }
};

export function detectGames(home = process.env.USERPROFILE || "") {
  const steamRoots = [path.join(process.env['ProgramFiles(x86)'] || '', 'Steam'), path.join(process.env.ProgramFiles || '', 'Steam')];
  for (const root of [...steamRoots]) {
    const libraries=path.join(root,'steamapps','libraryfolders.vdf');
    if(existsSync(libraries)) for(const match of readFileSync(libraries,'utf8').matchAll(/"path"\s+"([^"]+)"/g)) steamRoots.push(match[1].replace(/\\\\/g,'\\'));
  }
  return Object.entries(definitions).map(([id,d])=>{const candidates=steamRoots.map(root=>path.join(root,'steamapps','common',d.documents,'bin','win_x64',d.exe));const executable=candidates.find(existsSync);return{id,...d,installed:Boolean(executable),executable:executable||null,profileDir:path.join(home,'Documents','Euro Truck Simulator 2'.includes(d.documents)?d.documents:d.documents)};});
}
