import type { DispatchFileRequest, DispatchFileResult } from './dispatcher-service.ts';
import { DispatcherService } from './dispatcher-service.ts';

export const DISPATCH_JOB_CHANNEL = 'vtc-dispatcher:inject-job' as const;

type IpcMainLike = {
  handle(channel: string, listener: (event: unknown, request: unknown) => Promise<unknown> | unknown): void;
  removeHandler(channel: string): void;
};

type IpcRendererLike = {
  invoke(channel: string, request: DispatchFileRequest): Promise<DispatchFileResult>;
};

export function registerDispatcherIpc(ipcMain: IpcMainLike, service = new DispatcherService()): () => void {
  ipcMain.handle(DISPATCH_JOB_CHANNEL, async (_event, rawRequest) => {
    const request = validateIpcRequest(rawRequest);
    return service.injectFile(request);
  });
  return () => ipcMain.removeHandler(DISPATCH_JOB_CHANNEL);
}

export function createDispatcherRendererApi(ipcRenderer: IpcRendererLike) {
  return Object.freeze({
    injectJob(request: DispatchFileRequest): Promise<DispatchFileResult> {
      return ipcRenderer.invoke(DISPATCH_JOB_CHANNEL, request);
    },
  });
}

export function validateIpcRequest(value: unknown): DispatchFileRequest {
  if (!isRecord(value)) throw new Error('Dispatcher-Anfrage muss ein Objekt sein');
  const string = (key: string): string => {
    const current = value[key];
    if (typeof current !== 'string' || current.length < 1 || current.length > 1024) throw new Error(`${key} ist ungültig`);
    return current;
  };
  const durationMinutes = value.durationMinutes;
  if (!Number.isSafeInteger(durationMinutes)) throw new Error('durationMinutes ist ungültig');
  const urgency = value.urgency;
  if (urgency !== undefined && urgency !== 0 && urgency !== 1 && urgency !== 2) throw new Error('urgency ist ungültig');
  const distanceKm = value.distanceKm;
  if (distanceKm !== undefined && typeof distanceKm !== 'number') throw new Error('distanceKm ist ungültig');
  const expectedSha256 = value.expectedSha256;
  if (expectedSha256 !== undefined && (typeof expectedSha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(expectedSha256))) throw new Error('expectedSha256 ist ungültig');
  const templateOfferId = value.templateOfferId;
  if (templateOfferId !== undefined && typeof templateOfferId !== 'string') throw new Error('templateOfferId ist ungültig');
  return {
    gameSiiPath: string('gameSiiPath'),
    sourceCompanyUnit: string('sourceCompanyUnit'),
    destinationCompanyUnit: string('destinationCompanyUnit'),
    cargo: string('cargo'),
    trailerVariant: string('trailerVariant'),
    trailerDefinition: string('trailerDefinition'),
    durationMinutes,
    urgency,
    distanceKm,
    expectedSha256,
    templateOfferId,
  } as DispatchFileRequest;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

