import { cloneUnit, scalar } from './sii-types.ts';
import type { SiiDocument, SiiProperty, SiiUnit } from './sii-types.ts';
import { PointerGenerator } from './pointer-generator.ts';

const POINTER_PATTERN = /^_nameless\.[0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4}$/i;
const TOKEN_PATTERN = /^[a-z0-9_.-]+$/i;
const COMPANY_PATTERN = /^company\.volatile\.([^.\s]+)\.([^\s]+)$/i;

export type JobInjectionRequest = {
  sourceCompanyUnit: string;
  destinationCompanyUnit: string;
  cargo: string;
  trailerVariant: string;
  trailerDefinition: string;
  durationMinutes: number;
  urgency?: 0 | 1 | 2;
  distanceKm?: number;
  templateOfferId?: string;
};

export type JobInjectionResult = {
  document: SiiDocument;
  jobId: string;
  sourceCompanyUnit: string;
  destinationCompanyUnit: string;
  slot: number;
  replacedJobId: string | null;
  gameTime: number;
  timeLimit: number;
};

export class JobInjectionError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'JobInjectionError';
    this.code = code;
  }
}

export class JobInjector {
  inject(input: SiiDocument, request: JobInjectionRequest): JobInjectionResult {
    this.validateRequest(request);
    const document: SiiDocument = { kind: 'document', units: input.units.map(cloneUnit) };
    const source = this.requireCompany(document, request.sourceCompanyUnit, 'Quellfirma');
    const destination = this.requireCompany(document, request.destinationCompanyUnit, 'Zielfirma');
    const gameTime = this.requireGameTime(document);
    const timeLimit = this.calculateTimeLimit(gameTime, request.durationMinutes);
    const offers = new Map(document.units.filter((unit) => this.isOffer(unit)).map((unit) => [unit.id, unit]));
    const template = this.selectTemplate(source, offers, request);
    const pointer = PointerGenerator.fromDocument(document).next();
    const job = this.createJob(pointer, template, destination, request, timeLimit);
    const assignment = this.assignSlot(source, offers);

    this.setArrayValue(source, 'job_offer', assignment.slot, pointer);
    this.setScalar(source, 'job_offer', String(this.arrayLength(source, 'job_offer')));
    document.units.push(job);
    if (assignment.replacedJobId && this.referenceCount(document, assignment.replacedJobId) === 0) {
      document.units = document.units.filter((unit) => unit.id !== assignment.replacedJobId);
    }

    this.verify(document, source.id, destination.id, pointer, assignment.slot, request, timeLimit);
    return {
      document,
      jobId: pointer,
      sourceCompanyUnit: source.id,
      destinationCompanyUnit: destination.id,
      slot: assignment.slot,
      replacedJobId: assignment.replacedJobId,
      gameTime,
      timeLimit,
    };
  }

  calculateTimeLimit(gameTime: number, durationMinutes: number): number {
    if (!Number.isSafeInteger(gameTime) || gameTime < 0) throw new JobInjectionError('game_time ist ungültig', 'INVALID_GAME_TIME');
    if (!Number.isSafeInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 60 * 24 * 14) {
      throw new JobInjectionError('Die Auftragsdauer muss zwischen 1 Minute und 14 Spieltagen liegen', 'INVALID_DURATION');
    }
    const result = gameTime + durationMinutes;
    if (!Number.isSafeInteger(result)) throw new JobInjectionError('time_limit überschreitet den sicheren Zahlenbereich', 'TIME_OVERFLOW');
    return result;
  }

  private createJob(id: string, template: SiiUnit, destination: SiiUnit, request: JobInjectionRequest, timeLimit: number): SiiUnit {
    const job = cloneUnit(template);
    job.id = id;
    job.unitType = template.unitType;
    const destinationToken = this.companyTarget(destination.id);
    this.setScalar(job, 'target', `"${destinationToken}"`);
    if (this.property(job, 'time_limit')) this.setScalar(job, 'time_limit', String(timeLimit));
    if (this.property(job, 'expiration_time')) this.setScalar(job, 'expiration_time', String(timeLimit));
    this.setScalar(job, 'cargo', request.cargo);
    this.setScalar(job, 'trailer_variant', request.trailerVariant);
    this.setScalar(job, 'trailer_definition', request.trailerDefinition);
    if (request.urgency !== undefined) this.setScalar(job, 'urgency', String(request.urgency));
    if (request.distanceKm !== undefined) this.setScalar(job, 'shortest_distance_km', String(request.distanceKm));
    return job;
  }

  private selectTemplate(source: SiiUnit, offers: Map<string, SiiUnit>, request: JobInjectionRequest): SiiUnit {
    const ids = this.arrayProperties(source, 'job_offer').map((property) => property.value.raw).filter((id) => id !== 'null');
    const candidates = ids.map((id) => offers.get(id)).filter((unit): unit is SiiUnit => Boolean(unit));
    const selected = request.templateOfferId
      ? candidates.find((unit) => unit.id === request.templateOfferId)
      : candidates.find((unit) => this.hasRequiredTemplateFields(unit));
    if (!selected) {
      throw new JobInjectionError('Die Quellfirma besitzt keine vollständige company_job-/job_offer_data-Vorlage', 'TEMPLATE_NOT_FOUND');
    }
    if (!this.hasRequiredTemplateFields(selected)) {
      throw new JobInjectionError(`Vorlage ${selected.id} enthält nicht alle Pflichtfelder`, 'INVALID_TEMPLATE');
    }
    return selected;
  }

  private assignSlot(source: SiiUnit, offers: Map<string, SiiUnit>): { slot: number; replacedJobId: string | null } {
    const entries = this.arrayProperties(source, 'job_offer');
    const nullEntry = entries.find((property) => property.value.raw === 'null');
    if (nullEntry?.index !== null && nullEntry?.index !== undefined) return { slot: nullEntry.index, replacedJobId: null };

    const declared = this.numberProperty(source, 'job_offer');
    const highest = entries.reduce((maximum, property) => Math.max(maximum, property.index ?? -1), -1);
    if (declared > highest + 1) return { slot: highest + 1, replacedJobId: null };
    if (entries.length === 0) return { slot: 0, replacedJobId: null };

    const ranked = entries.map((property) => {
      const offer = offers.get(property.value.raw);
      const expiration = offer ? this.numericField(offer, ['expiration_time', 'time_limit'], Number.MAX_SAFE_INTEGER) : -1;
      return { property, expiration };
    }).sort((left, right) => left.expiration - right.expiration || (left.property.index ?? 0) - (right.property.index ?? 0));
    const victim = ranked[0]?.property;
    if (!victim) throw new JobInjectionError('job_offer-Array enthält keinen ersetzbaren Eintrag', 'INVALID_JOB_ARRAY');
    if (victim.index === null) throw new JobInjectionError('job_offer-Array enthält einen ungültigen Eintrag', 'INVALID_JOB_ARRAY');
    return { slot: victim.index, replacedJobId: victim.value.raw === 'null' ? null : victim.value.raw };
  }

  private verify(document: SiiDocument, sourceId: string, destinationId: string, jobId: string, slot: number, request: JobInjectionRequest, timeLimit: number): void {
    const source = this.requireCompany(document, sourceId, 'Quellfirma');
    const job = document.units.find((unit) => unit.id === jobId);
    if (!job || !POINTER_PATTERN.test(job.id)) throw new JobInjectionError('Nachprüfung: Job-Unit fehlt', 'VERIFY_JOB_MISSING');
    if (this.property(job, 'target')?.value.raw !== `"${this.companyTarget(destinationId)}"`) throw new JobInjectionError('Nachprüfung: Ziel stimmt nicht', 'VERIFY_TARGET');
    if (this.property(job, this.timeField(job))?.value.raw !== String(timeLimit)) throw new JobInjectionError('Nachprüfung: time_limit stimmt nicht', 'VERIFY_TIME');
    if (this.property(job, 'cargo')?.value.raw !== request.cargo) throw new JobInjectionError('Nachprüfung: Fracht stimmt nicht', 'VERIFY_CARGO');
    if (this.property(job, 'trailer_variant')?.value.raw !== request.trailerVariant) throw new JobInjectionError('Nachprüfung: Trailer-Variante stimmt nicht', 'VERIFY_TRAILER_VARIANT');
    if (this.property(job, 'trailer_definition')?.value.raw !== request.trailerDefinition) throw new JobInjectionError('Nachprüfung: Trailer-Definition stimmt nicht', 'VERIFY_TRAILER_DEFINITION');
    if (this.arrayProperties(source, 'job_offer').find((property) => property.index === slot)?.value.raw !== jobId) throw new JobInjectionError('Nachprüfung: Firmen-Slot verweist nicht auf den neuen Job', 'VERIFY_SLOT');
  }

  private requireGameTime(document: SiiDocument): number {
    for (const unit of document.units) {
      const property = this.property(unit, 'game_time');
      if (!property) continue;
      const value = Number(property.value.raw);
      if (Number.isSafeInteger(value) && value >= 0) return value;
      throw new JobInjectionError('game_time ist kein gültiger nicht-negativer Integer', 'INVALID_GAME_TIME');
    }
    throw new JobInjectionError('game_time wurde im Spielstand nicht gefunden', 'GAME_TIME_MISSING');
  }

  private requireCompany(document: SiiDocument, id: string, label: string): SiiUnit {
    const company = document.units.find((unit) => unit.unitType === 'company' && unit.id === id);
    if (!company) throw new JobInjectionError(`${label} ${id} wurde nicht gefunden`, 'COMPANY_NOT_FOUND');
    return company;
  }

  private validateRequest(request: JobInjectionRequest): void {
    if (!COMPANY_PATTERN.test(request.sourceCompanyUnit)) throw new JobInjectionError('Quellfirma hat kein gültiges company.volatile.*.*-Format', 'INVALID_SOURCE');
    if (!COMPANY_PATTERN.test(request.destinationCompanyUnit)) throw new JobInjectionError('Zielfirma hat kein gültiges company.volatile.*.*-Format', 'INVALID_DESTINATION');
    for (const [label, value] of [['cargo', request.cargo], ['trailer_variant', request.trailerVariant], ['trailer_definition', request.trailerDefinition]] as const) {
      if (!TOKEN_PATTERN.test(value)) throw new JobInjectionError(`${label} enthält ungültige Zeichen`, 'INVALID_TOKEN');
    }
    this.calculateTimeLimit(0, request.durationMinutes);
    if (request.distanceKm !== undefined && (!Number.isFinite(request.distanceKm) || request.distanceKm <= 0 || request.distanceKm > 100000)) throw new JobInjectionError('Entfernung ist ungültig', 'INVALID_DISTANCE');
  }

  private companyTarget(id: string): string {
    const match = COMPANY_PATTERN.exec(id);
    if (!match) throw new JobInjectionError(`Ungültige Firmen-ID ${id}`, 'INVALID_COMPANY_ID');
    return `${match[1]}.${match[2]}`;
  }

  private isOffer(unit: SiiUnit): boolean { return unit.unitType === 'company_job' || unit.unitType === 'job_offer_data'; }
  private hasRequiredTemplateFields(unit: SiiUnit): boolean {
    return ['target', 'cargo', 'trailer_variant', 'trailer_definition'].every((key) => Boolean(this.property(unit, key)))
      && Boolean(this.property(unit, 'time_limit') ?? this.property(unit, 'expiration_time'));
  }
  private timeField(unit: SiiUnit): 'time_limit' | 'expiration_time' { return this.property(unit, 'time_limit') ? 'time_limit' : 'expiration_time'; }
  private property(unit: SiiUnit, key: string): SiiProperty | undefined { return unit.properties.find((property) => property.key === key && property.index === null); }
  private arrayProperties(unit: SiiUnit, key: string): SiiProperty[] { return unit.properties.filter((property) => property.key === key && property.index !== null).sort((a, b) => (a.index ?? 0) - (b.index ?? 0)); }
  private arrayLength(unit: SiiUnit, key: string): number { return this.arrayProperties(unit, key).reduce((maximum, property) => Math.max(maximum, (property.index ?? -1) + 1), 0); }
  private numberProperty(unit: SiiUnit, key: string): number { const value = Number(this.property(unit, key)?.value.raw ?? 0); return Number.isSafeInteger(value) && value >= 0 ? value : 0; }
  private numericField(unit: SiiUnit, keys: string[], fallback: number): number { for (const key of keys) { const value = Number(this.property(unit, key)?.value.raw); if (Number.isFinite(value)) return value; } return fallback; }
  private referenceCount(document: SiiDocument, id: string): number {
    return document.units.reduce((count, unit) => count + unit.properties.filter((property) => property.value.raw === id).length, 0);
  }
  private setScalar(unit: SiiUnit, key: string, raw: string): void {
    const property = this.property(unit, key);
    if (!property) throw new JobInjectionError(`Pflichtfeld ${key} fehlt in ${unit.id}`, 'MISSING_FIELD');
    property.value = scalar(raw);
  }
  private setArrayValue(unit: SiiUnit, key: string, index: number, raw: string): void {
    const property = this.arrayProperties(unit, key).find((candidate) => candidate.index === index);
    if (property) property.value = scalar(raw);
    else unit.properties.push({ kind: 'property', key, index, value: scalar(raw) });
  }
}
