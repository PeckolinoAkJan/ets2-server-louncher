import { closeSync, copyFileSync, existsSync, fsyncSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { JobInjector } from './job-injector.js';
import type { JobInjectionRequest } from './job-injector.js';
import { SiiParser } from './sii-parser.js';

export type DispatchFileRequest = JobInjectionRequest & {
  gameSiiPath: string;
  expectedSha256?: string;
};

export type DispatchFileResult = {
  ok: true;
  file: string;
  backup: string;
  beforeSha256: string;
  afterSha256: string;
  jobId: string;
  slot: number;
  replacedJobId: string | null;
  timeLimit: number;
};

export class DispatcherService {
  private readonly parser: SiiParser;
  private readonly injector: JobInjector;

  constructor(parser = new SiiParser(), injector = new JobInjector()) {
    this.parser = parser;
    this.injector = injector;
  }

  injectFile(request: DispatchFileRequest): DispatchFileResult {
    const file = resolve(request.gameSiiPath);
    if (!existsSync(file) || !statSync(file).isFile()) throw new Error(`game.sii wurde nicht gefunden: ${file}`);
    if (file.split(/[\\/]/).at(-1)?.toLowerCase() !== 'game.sii') throw new Error('Dispatcher darf ausschließlich eine game.sii bearbeiten');

    const original = readFileSync(file);
    const beforeSha256 = sha256(original);
    if (request.expectedSha256 && request.expectedSha256.toLowerCase() !== beforeSha256) {
      throw new Error('Der Spielstand wurde seit dem Einlesen verändert; Auftrag wurde nicht geschrieben');
    }
    const source = original.toString('utf8').replace(/^\uFEFF/, '');
    if (!source.startsWith('SiiNunit')) throw new Error('game.sii ist verschlüsselt und muss vor der Bearbeitung entschlüsselt werden');

    const document = this.parser.parse(source);
    const injected = this.injector.inject(document, request);
    const output = this.parser.serialize(injected.document);
    const roundTrip = this.parser.parse(output);
    const proof = roundTrip.units.find((unit) => unit.id === injected.jobId);
    if (!proof) throw new Error('Serialisierungsprüfung konnte den neuen Job nicht wieder einlesen');

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backup = `${file}.vtc-${stamp}.bak`;
    const temporary = resolve(dirname(file), `.game.sii.vtc-${randomUUID()}.tmp`);
    copyFileSync(file, backup);
    try {
      const descriptor = openSync(temporary, 'wx', statSync(file).mode);
      try {
        writeFileSync(descriptor, output, 'utf8');
        fsyncSync(descriptor);
      } finally {
        closeSync(descriptor);
      }
      if (sha256(readFileSync(file)) !== beforeSha256) throw new Error('Der Spielstand wurde während des Schreibens verändert');
      renameSync(temporary, file);
    } catch (error) {
      if (existsSync(temporary)) unlinkSync(temporary);
      throw error;
    }

    let written: Buffer;
    try {
      written = readFileSync(file);
      const writtenDocument = this.parser.parse(written.toString('utf8'));
      if (!writtenDocument.units.some((unit) => unit.id === injected.jobId)) throw new Error('Der neue Job fehlt nach dem Dateitausch');
    } catch (error) {
      copyFileSync(backup, file);
      throw new Error(`Nachprüfung der geschriebenen game.sii fehlgeschlagen; Backup wurde zurückgespielt: ${error instanceof Error ? error.message : String(error)}`);
    }
    const afterSha256 = sha256(written);
    if (afterSha256 === beforeSha256) {
      copyFileSync(backup, file);
      throw new Error('Der geschriebene Spielstand ist unverändert; Backup wurde zurückgespielt');
    }
    return {
      ok: true,
      file,
      backup,
      beforeSha256,
      afterSha256,
      jobId: injected.jobId,
      slot: injected.slot,
      replacedJobId: injected.replacedJobId,
      timeLimit: injected.timeLimit,
    };
  }
}

function sha256(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}
