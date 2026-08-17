import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { INTRO_STORAGE_KEY, readIntroDismissed, writeIntroDismissed } from '../src/intro-storage.js';
import { findDemoProvider, nextDemoJurisdiction } from '../src/demo-scenarios.js';

describe('intro storage', () => {
  it('uses the single dismissed key and nothing else', () => {
    assert.equal(INTRO_STORAGE_KEY, 'airp.intro.dismissed');
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    };
    assert.equal(readIntroDismissed(storage), false);
    writeIntroDismissed(storage, true);
    assert.deepEqual([...store.keys()], [INTRO_STORAGE_KEY]);
    assert.equal(readIntroDismissed(storage), true);
    writeIntroDismissed(storage, false);
    assert.equal(store.size, 0);
    assert.equal(readIntroDismissed(storage), false);
  });
});

describe('demo provider lookup', () => {
  it('prefers the mock id over a similarly labelled live provider', () => {
    const providers = [
      { id: 'llama', registerEntryId: null },
      { id: 'aligned', registerEntryId: 'demo.aligned' },
      { id: 'legacy', registerEntryId: 'demo.legacy' },
    ];
    assert.equal(findDemoProvider(providers, 'aligned'), 'aligned');
    assert.equal(findDemoProvider(providers, 'legacy'), 'legacy');
  });
});

describe('jurisdiction toggle', () => {
  it('switches eu and us-ny when both are present', () => {
    const available = [{ id: 'none' }, { id: 'us-ny' }, { id: 'eu' }];
    assert.equal(nextDemoJurisdiction('us-ny', available), 'eu');
    assert.equal(nextDemoJurisdiction('eu', available), 'us-ny');
  });
});
