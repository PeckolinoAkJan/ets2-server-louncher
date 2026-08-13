import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const asDate=value=>value?new Date(value):null;

export async function createDatabase(env=process.env){
  const url=String(env.DATABASE_URL||'').trim();
  const socketPath=String(env.DB_SOCKET||'').trim();
  if(!url&&!socketPath)return new DisabledDatabase();
  const mysql=await import('mysql2/promise');
  const connection=url?{uri:url}:{socketPath,user:env.DB_USER,database:env.DB_NAME,password:env.DB_PASSWORD};
  const pool=mysql.createPool({...connection,connectionLimit:Number(env.DB_POOL_SIZE||8),enableKeepAlive:true,timezone:'Z',charset:'utf8mb4'});
  const schema=await readFile(path.join(ROOT,'database','schema.sql'),'utf8');
  for(const statement of schema.split(/;\s*(?:\r?\n|$)/).map(x=>x.trim()).filter(Boolean))await pool.query(statement);
  return new MariaDatabase(pool);
}

class DisabledDatabase{enabled=false;async close(){} async hydrate(value){return value} async importLegacy(){} async saveUsers(){} async saveDrivers(){} async saveSessions(){} async saveConfig(){} async audit(){} async telemetry(){} async dispatcherJob(){} }

class MariaDatabase{
  enabled=true;
  constructor(pool){this.pool=pool}
  async close(){await this.pool.end()}
  async hydrate(fallback){
    const [u]=await this.pool.query('SELECT id,username,role,password_salt salt,password_hash hash FROM admin_users');
    const [d]=await this.pool.query('SELECT id,display_name displayName,steam_id steamId,status,registered_at registeredAt,last_login_at lastLoginAt FROM drivers');
    const [s]=await this.pool.query('SELECT token_hash hash,driver_id vtcAccountId,steam_id steamId,display_name displayName,role,UNIX_TIMESTAMP(expires_at)*1000 expires FROM client_sessions WHERE expires_at>UTC_TIMESTAMP(3)');
    return{users:u.length?u:fallback.users,drivers:d.length?d:fallback.drivers,sessions:s.length?s:fallback.sessions};
  }
  async importLegacy({users=[],drivers=[],sessions=[]}){await this.saveUsers(users);await this.saveDrivers(drivers);await this.saveSessions(sessions)}
  async saveUsers(items){for(const x of items)await this.pool.execute('INSERT INTO admin_users(id,username,role,password_salt,password_hash) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE username=VALUES(username),role=VALUES(role),password_salt=VALUES(password_salt),password_hash=VALUES(password_hash)',[x.id,x.username,x.role||'admin',x.salt,x.hash]);if(items.length)await this.pool.query('DELETE FROM admin_users WHERE id NOT IN (?)',[items.map(x=>x.id)])}
  async saveDrivers(items){for(const x of items)await this.pool.execute('INSERT INTO drivers(id,display_name,steam_id,status,registered_at,last_login_at) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE display_name=VALUES(display_name),steam_id=VALUES(steam_id),status=VALUES(status),last_login_at=VALUES(last_login_at)',[x.id,x.displayName,x.steamId||null,x.status||'pending',asDate(x.registeredAt)||new Date(),asDate(x.lastLoginAt)]);if(items.length)await this.pool.query('DELETE FROM drivers WHERE id NOT IN (?)',[items.map(x=>x.id)])}
  async deleteDriver(id){await this.pool.execute('DELETE FROM drivers WHERE id=?',[id])}
  async saveSessions(items){await this.pool.execute('DELETE FROM client_sessions');for(const x of items)await this.pool.execute('INSERT INTO client_sessions(token_hash,driver_id,steam_id,display_name,role,expires_at) VALUES(?,?,?,?,?,?)',[x.hash,x.vtcAccountId,x.steamId,x.displayName,x.role||'driver',new Date(x.expires)])}
  async saveConfig(game,config){await this.pool.execute('INSERT INTO server_profiles(game,config_json) VALUES(?,?) ON DUPLICATE KEY UPDATE config_json=VALUES(config_json)',[game,JSON.stringify(config)])}
  async audit(actor,action,detail=''){await this.pool.execute('INSERT INTO audit_events(actor,action,detail) VALUES(?,?,?)',[actor||'system',action,String(detail).slice(0,500)])}
  async telemetry(game,key,driverId,payload){await this.pool.execute('INSERT INTO telemetry_current(game,driver_key,driver_id,payload_json,updated_at) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE driver_id=VALUES(driver_id),payload_json=VALUES(payload_json),updated_at=VALUES(updated_at)',[game,key,driverId||null,JSON.stringify(payload),new Date(payload.updatedAt||Date.now())])}
  async dispatcherJob(driverId,offer){await this.pool.execute('INSERT INTO dispatcher_jobs(id,driver_id,game,map_profile,source_city,source_company,destination_city,destination_company,cargo,trailer_mode,payload_json) VALUES(?,?,?,?,?,?,?,?,?,?,?)',[offer.id,driverId,offer.game,offer.mapProfile||'standard',offer.sourceCity||'',offer.sourceCompany||'',offer.destinationCity||'',offer.destinationCompany||'',offer.cargo||'',offer.useOwnedTrailer?'owned':'provided',JSON.stringify(offer)])}
}
