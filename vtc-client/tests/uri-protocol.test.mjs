import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('Installer registriert ein benutzerbezogenes und deinstallierbares VTC-URI-Protokoll',()=>{
  const installer=readFileSync(new URL('../../launcher-src/installer.iss',import.meta.url),'utf8');
  assert.match(installer,/Software\\Classes\\vtctruckhub/);
  assert.match(installer,/URL Protocol/);
  assert.match(installer,/Flags: uninsdeletekey/);
  assert.match(installer,/%1/);
  const app=readFileSync(new URL('../../launcher-src/VtcTruckHub.Launcher/App.xaml.cs',import.meta.url),'utf8');
  assert.match(app,/Registry\.CurrentUser\.CreateSubKey/);
  assert.match(app,/Software\\Classes\\vtctruckhub/);
});
