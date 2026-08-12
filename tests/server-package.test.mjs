import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
test('Linux-Paket verteilt den geprüften ETS2-Client ohne lokale Profildaten',()=>{const root=path.resolve(import.meta.dirname,'..'),zip=path.join(root,'release','ETS2-Server-Control-1.4.1-ets2-test.zip'),temp=mkdtempSync(path.join(os.tmpdir(),'vtc-server-package-'));execFileSync('powershell.exe',['-NoProfile','-Command',`Expand-Archive -LiteralPath '${zip.replaceAll("'","''")}' -DestinationPath '${temp.replaceAll("'","''")}' -Force`],{windowsHide:true});const release=JSON.parse(readFileSync(path.join(temp,'public','downloads','client-release.json'),'utf8').replace(/^\uFEFF/,''));assert.equal(release.version,'0.4.2-test');assert.match(release.sha256,/^[A-F0-9]{64}$/);assert.equal(existsSync(path.join(temp,'public','downloads','VTC-ETS2-Client-Windows.zip')),true);assert.equal(existsSync(path.join(temp,'vtc-client')),false);assert.equal(existsSync(path.join(temp,'active-test-save.json')),false);rmSync(temp,{recursive:true,force:true});});
