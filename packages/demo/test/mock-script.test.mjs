// Substitution script reset/arm. Paper: steps 4 and 5 (the live mismatch demo).
// The claim: a visitor can return the aligned mock to an honest first seal without
// restarting the process.

import assert from 'node:assert/strict';
import test from 'node:test';
import { startMockProvider } from '../dist/mock-provider.js';

test('resetScript returns the substitution counter to an honest next seal', async () => {
  const mock = await startMockProvider({
    port: 0,
    model: 'aligned-1',
    script: ['one', 'two'],
    substituteFrom: { response: 2, model: 'aligned-1-turbo' },
    streamChunkDelayMs: 0,
  });
  try {
    assert.equal(mock.scriptState().substitutingNext, false);
    await fetch(`${mock.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'aligned-1', messages: [] }),
    });
    assert.equal(mock.requestCount(), 1);
    assert.equal(mock.scriptState().substitutingNext, true);

    const reset = await fetch(`${mock.baseUrl}/demo/reset`, { method: 'POST' });
    const resetBody = await reset.json();
    assert.equal(resetBody.ok, true);
    assert.equal(resetBody.served, 0);
    assert.equal(resetBody.substitutingNext, false);

    const armed = await fetch(`${mock.baseUrl}/demo/arm-mismatch`, { method: 'POST' });
    const armedBody = await armed.json();
    assert.equal(armedBody.ok, true);
    assert.equal(armedBody.substitutingNext, true);
  } finally {
    await mock.close();
  }
});

test('GET /demo/state reports the counter without resetting it', async () => {
  const mock = await startMockProvider({
    port: 0,
    model: 'aligned-1',
    script: ['one', 'two'],
    substituteFrom: { response: 2, model: 'aligned-1-turbo' },
    streamChunkDelayMs: 0,
  });
  try {
    await fetch(`${mock.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'aligned-1', messages: [] }),
    });
    assert.equal(mock.scriptState().served, 1);
    assert.equal(mock.scriptState().substitutingNext, true);

    const state = await fetch(`${mock.baseUrl}/demo/state`);
    const body = await state.json();
    assert.equal(state.status, 200);
    assert.equal(body.served, 1);
    assert.equal(body.substitutingNext, true);
    assert.equal(mock.scriptState().served, 1);
    assert.equal(mock.scriptState().substitutingNext, true);
  } finally {
    await mock.close();
  }
});
