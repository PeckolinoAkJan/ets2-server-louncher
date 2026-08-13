import test from 'node:test';
import assert from 'node:assert/strict';
import { DISPATCH_JOB_CHANNEL, createDispatcherRendererApi, registerDispatcherIpc, validateIpcRequest } from '../src/electron-ipc.ts';
import { request } from './fixture.ts';

test('IPC validiert Renderer-Daten und reicht nur typisierte Werte weiter', async () => {
  let handler: ((event: unknown, request: unknown) => unknown) | undefined;
  let removed = false;
  const result = { ok: true as const, file: 'x', backup: 'b', beforeSha256: '1', afterSha256: '2', jobId: '_nameless.0000.0000.0001', slot: 0, replacedJobId: null, timeLimit: 1 };
  const dispose = registerDispatcherIpc({ handle: (channel, listener) => { assert.equal(channel, DISPATCH_JOB_CHANNEL); handler = listener; }, removeHandler: () => { removed = true; } }, { injectFile: () => result } as never);
  assert.deepEqual(await handler?.(null, { ...request, gameSiiPath: 'C:/save/game.sii' }), result);
  dispose();
  assert.equal(removed, true);
  assert.throws(() => validateIpcRequest({ ...request, gameSiiPath: 'x', urgency: 9 }), /urgency/);
});

test('Renderer-API verwendet ausschließlich invoke', async () => {
  const calls: unknown[][] = [];
  const api = createDispatcherRendererApi({ invoke: async (...args: unknown[]) => { calls.push(args); return {} as never; } } as never);
  await api.injectJob({ ...request, gameSiiPath: 'C:/save/game.sii' });
  assert.equal(calls[0]?.[0], DISPATCH_JOB_CHANNEL);
});
