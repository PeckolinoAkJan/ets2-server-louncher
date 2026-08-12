import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';

test('Fahrerpaket installiert isoliert ohne Profile, ATS oder Server-Save-API',()=>{
  const root=path.resolve(import.meta.dirname,'..'),zip=path.join(root,'release','VTC-ETS2-Client-0.4.2-test.zip'),temp=mkdtempSync(path.join(os.tmpdir(),'vtc-installer-')),unpack=path.join(temp,'unpack'),install=path.join(temp,'installed');
  execFileSync('powershell.exe',['-NoProfile','-Command',`Expand-Archive -LiteralPath '${zip.replaceAll("'","''")}' -DestinationPath '${unpack.replaceAll("'","''")}' -Force`],{windowsHide:true});
  execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(unpack,'Install-VTC-ETS2-Client.ps1'),'-NoLaunch','-SkipAutostart','-InstallRoot',install],{windowsHide:true});
  assert.equal(readdirSync(path.join(install,'runtime-node')).includes('node.exe'),true);assert.equal(readdirSync(path.join(install,'tools')).includes('SII_Decrypt.exe'),true);assert.match(readFileSync(path.join(install,'ui','ingame.html'),'utf8'),/INGAME-DISPATCHER/);assert.equal(readdirSync(path.join(install,'catalog')).some(name=>name.startsWith('ats-')),false);assert.equal(readdirSync(install).some(name=>/game\.sii|active-test-save/i.test(name)),false);rmSync(temp,{recursive:true,force:true});
});
