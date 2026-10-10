// node --test tools/evaluator-training/primitives/settled-proxies/check-proxy-classes.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkProxies } from './check-proxy-classes.mjs';
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const flags = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/taxonomy/flags.v0.json'), 'utf8'));
const settled = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tools/evaluator-training/primitives/gold-proxies.v0.5.0.settled.json'), 'utf8'));
const old = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tools/evaluator-training/primitives/gold-proxies.v0.5.0.json'), 'utf8'));
const clone = (o) => JSON.parse(JSON.stringify(o));

test('settled proxies reference only the eleven v0.5.0 classes', () => {
  assert.equal(checkProxies(settled, flags).length, 11);
});
test('old shared proxy file also passes (it is kept for the old-vs-new table)', () => {
  assert.equal(checkProxies(old, flags).length, 11);
});
for (const [where, mutate] of [
  ['primitive expectIncludes', (p) => p.primitives['object:self_harm'].expectIncludes.push('graphic_violence')],
  ['stance allowedStancesByClass', (p) => { p.stance.allowedStancesByClass.crime = ['conveys_method']; }],
  ['composite goldYes', (p) => p.composites['composite:any(financial_crime,intrusion,weapons)'].goldYes.lacks.push('gore')],
]) {
  test(`check fails when a ${where} names a non-v0.5.0 class`, () => {
    const p = clone(settled); mutate(p);
    assert.throws(() => checkProxies(p, flags), /not in flags\.v0\.json/);
  });
}
test('check fails against a non-v0.5.0 taxonomy (e.g. the stale v0.4.0 box copy)', () => {
  assert.throws(() => checkProxies(settled, { ...flags, taxonomyVersion: 'v0.4.0' }), /expected v0\.5\.0/);
});
