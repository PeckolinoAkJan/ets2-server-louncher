import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDatabase} from '../lib/database.mjs';

test('ohne DATABASE_URL bleibt der isolierte Dateimodus aktiv',async()=>{
  const db=await createDatabase({});
  assert.equal(db.enabled,false);
  assert.deepEqual(await db.hydrate({users:[],drivers:[],sessions:[]}),{users:[],drivers:[],sessions:[]});
});

test('MariaDB-Schema deckt Accounts, Sessions, Dispatcher, Telemetrie und Audit ab',async()=>{
  const sql=await readFile(new URL('../database/schema.sql',import.meta.url),'utf8');
  for(const table of ['admin_users','drivers','client_sessions','server_profiles','dispatcher_jobs','telemetry_current','convoys','client_versions','audit_events'])assert.match(sql,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  assert.match(sql,/FOREIGN KEY \(driver_id\) REFERENCES drivers\(id\) ON DELETE CASCADE/);
});
