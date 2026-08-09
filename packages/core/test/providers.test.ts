// ProviderRegistry order is the UI list order. Hot-reload must keep the file sequence.
//
// Paper: step 3 ("any certified advocate can front any registered provider").

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ProviderRegistry } from '@airp/core';
import type { ProviderConfig } from '@airp/core';

function stub(id: string): ProviderConfig {
  return { id, label: id, baseUrl: `http://127.0.0.1/${id}`, model: id };
}

test('list preserves constructor order', () => {
  const reg = new ProviderRegistry([stub('a'), stub('b'), stub('c')]);
  assert.deepEqual(
    reg.list().map((p) => p.id),
    ['a', 'b', 'c'],
  );
});

test('add of an existing id updates in place and does not reorder', () => {
  const reg = new ProviderRegistry([stub('a'), stub('b'), stub('c')]);
  reg.add({ ...stub('a'), label: 'renamed' });
  assert.deepEqual(
    reg.list().map((p) => p.id),
    ['a', 'b', 'c'],
  );
  assert.equal(reg.get('a')?.label, 'renamed');
});

test('replaceAll rebuilds in the caller order', () => {
  const reg = new ProviderRegistry([stub('a'), stub('b'), stub('c')]);
  reg.replaceAll([stub('c'), stub('a')]);
  assert.deepEqual(
    reg.list().map((p) => p.id),
    ['c', 'a'],
  );
  assert.equal(reg.get('b'), undefined);
});
