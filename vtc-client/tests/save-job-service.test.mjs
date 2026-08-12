import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {existsSync,mkdtempSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import os from 'node:os';
import {SaveJobService} from '../lib/save-job-service.mjs';

test('Schreibschutz akzeptiert ausschließlich den registrierten numerischen VTC-Slot',()=>{const root=mkdtempSync(path.join(os.tmpdir(),'vtc-job-')),save=path.join(root,'profile','save'),target=path.join(save,'3');mkdirSync(target,{recursive:true});writeFileSync(path.join(root,'active-test-save.json'),JSON.stringify({target}));const s=new SaveJobService(root);assert.equal(s.assertTarget(target),path.resolve(target));assert.throws(()=>s.assertTarget(path.join(save,'autosave')),/Manifest/);});

test('Einrichtung kopiert nur einen Autosave in einen freien VTC-Slot',()=>{const root=mkdtempSync(path.join(os.tmpdir(),'vtc-setup-')),user=mkdtempSync(path.join(os.tmpdir(),'vtc-user-')),save=path.join(user,'Documents','Euro Truck Simulator 2','profiles','abc','save'),source=path.join(save,'autosave'),occupied=path.join(save,'99');mkdirSync(source,{recursive:true});mkdirSync(occupied,{recursive:true});writeFileSync(path.join(source,'game.sii'),'SiiNunit\n{}');writeFileSync(path.join(source,'info.sii'),'SiiNunit\n{\n name: "Autosave"\n}');writeFileSync(path.join(occupied,'keep.txt'),'nicht anfassen');const old=process.env.USERPROFILE;process.env.USERPROFILE=user;const service=new SaveJobService(root);service.isGameRunning=()=>false;service.decryptor=()=>path.join(root,'unused.exe');assert.throws(()=>service.prepare({confirmed:false}),/bestätigt/);const result=service.prepare({confirmed:true});process.env.USERPROFILE=old;assert.equal(result.slot,98);assert.equal(readFileSync(path.join(occupied,'keep.txt'),'utf8'),'nicht anfassen');assert.equal(existsSync(path.join(save,'98','game.sii')),true);assert.equal(JSON.parse(readFileSync(path.join(root,'active-test-save.json'),'utf8')).target,path.join(save,'98'));});
