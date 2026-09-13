import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { INTRO_STORAGE_KEY, readIntroDismissed, writeIntroDismissed } from '../src/intro-storage.js';
import { INTRO_MORE_LINKS } from '../src/intro-links.js';
import { findDemoProvider, nextDemoJurisdiction, demoScriptStatus, scriptStatusTitle } from '../src/demo-scenarios.js';

describe('intro more-information links', () => {
  it('points at the paper, the IETF draft, the code, and the essay', () => {
    assert.deepEqual(
      INTRO_MORE_LINKS.map((l) => l.href),
      [
        'https://github.com/AIRP-spec/inference-advocate',
        'https://doi.org/10.5281/zenodo.21610185',
        'https://datatracker.ietf.org/doc/draft-flores-airp-provenance/',
        'https://logosanalog.com/p/we-can-pace-the-frontier-today-heres',
      ],
    );
    assert.deepEqual(
      INTRO_MORE_LINKS.map((l) => l.label),
      ['The code', 'The paper', 'The IETF draft', 'The essay'],
    );
  });
});

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

describe('substitution script status', () => {
  it('labels an honest next seal and a substituting next seal', () => {
    assert.equal(demoScriptStatus({ ok: true, substitutingNext: false, served: 0 }).kind, 'honest');
    assert.equal(demoScriptStatus({ ok: true, substitutingNext: true, served: 3 }).kind, 'substituting');
    assert.equal(demoScriptStatus({ ok: false }).kind, 'unreachable');
    assert.equal(demoScriptStatus(null).kind, 'unreachable');
  });

  it('says the status is shared and that a page load does not reset it', () => {
    const title = scriptStatusTitle({ kind: 'honest', label: 'next seal is honest', served: 0 });
    assert.match(title, /does not reset/);
    assert.match(title, /Shared by every visitor/);
  });
});
