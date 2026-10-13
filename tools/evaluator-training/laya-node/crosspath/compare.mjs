#!/usr/bin/env node
/**
 * Cross-path comparison. Fails (exit 1) unless, on every item, the Node path and the Python path
 * produce identical primitives (stance, objects, qualifiers, order-insensitive sets) AND identical
 * composed verdicts. Both paths' composed verdicts come from the one shared compose() in
 * @airp/evaluator-local; the Python path emits primitives only.
 *
 * Also reports max |logit difference| and the smallest Python-path decision margin, and checks
 * that the Node decode applied to the Python logits reproduces the Python decisions (decode
 * logic identity, independent of the model run).
 *
 * Usage: node compare.mjs --python PY.jsonl --node NODE.jsonl --pins PINS.json --composition C.json [--out R.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../../..');
const { compose, layaPrimitivesFromLogits } = await import(join(repo, 'packages/evaluator-local/dist/index.js'));

export function comparePaths(pyRows, nodeRows, pins, composition) {
  const py = new Map(pyRows.map((r) => [r.id, r]));
  const nd = new Map(nodeRows.map((r) => [r.id, r]));
  const key = (p) => JSON.stringify({ stance: p.stance, objects: [...p.objects].sort(), qualifiers: [...p.qualifiers].sort() });
  const problems = [];
  let maxAbsLogitDiff = 0;
  let minPyMargin = Infinity;
  const ids = [...py.keys()];
  if (ids.length !== nd.size || !ids.every((i) => nd.has(i))) problems.push({ kind: 'item-set', py: ids.length, node: nd.size });
  let primsIdentical = 0, composedIdentical = 0, decodeIdentical = 0, feedIdentical = 0, feedChecked = 0;
  for (const id of ids) {
    const a = py.get(id), b = nd.get(id);
    if (!b) continue;
    for (const [q, la] of Object.entries(a.logits)) {
      const lb = b.logits[q];
      la.forEach((v, j) => (maxAbsLogitDiff = Math.max(maxAbsLogitDiff, Math.abs(v - lb[j]))));
      if (q === pins.stanceQuestion) { const s = [...la].sort((x, y) => y - x); minPyMargin = Math.min(minPyMargin, s[0] - s[1]); }
      else minPyMargin = Math.min(minPyMargin, Math.abs(la[1] - la[0]));
    }
    const pyComposed = compose(a.prims, composition);
    const nodeComposed = compose(b.prims, composition);
    const dec = layaPrimitivesFromLogits(a.logits, pins);
    const decOk = key(dec) === key(a.prims);
    const primsOk = key(a.prims) === key(b.prims);
    const compOk = JSON.stringify([...pyComposed].sort()) === JSON.stringify([...nodeComposed].sort())
      && JSON.stringify([...nodeComposed].sort()) === JSON.stringify([...(b.composed ?? nodeComposed)].sort());
    // Packed layout (python row carries feed_sha256): both paths must have fed the model byte-identical tensors (SHA over all seven feed arrays).
    if (a.feed_sha256 !== undefined) {
      feedChecked++;
      if (a.feed_sha256 === b.feedSha256) feedIdentical++;
      else problems.push({ id, kind: 'packed-feed', python: a.feed_sha256, node: b.feedSha256 });
    }
    primsIdentical += primsOk; composedIdentical += compOk; decodeIdentical += decOk;
    if (!primsOk || !compOk || !decOk) problems.push({ id, python: a.prims, node: b.prims, pythonComposed: pyComposed, nodeComposed, decodeOnPythonLogits: decOk });
  }
  return { n: ids.length, primsIdentical, composedIdentical, decodeIdentical, feedChecked, feedIdentical, maxAbsLogitDiff, minPythonMargin: minPyMargin,
    pass: problems.length === 0, problems };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
  const rd = (p) => readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const pins = JSON.parse(readFileSync(arg('--pins'), 'utf8'));
  const composition = JSON.parse(readFileSync(arg('--composition'), 'utf8'));
  const rep = comparePaths(rd(arg('--python')), rd(arg('--node')), pins, composition);
  if (arg('--out')) writeFileSync(arg('--out'), JSON.stringify(rep, null, 1) + '\n');
  console.log(JSON.stringify({ ...rep, problems: rep.problems.slice(0, 10) }));
  console.log(rep.pass ? 'CROSSPATH_PASS' : 'CROSSPATH_FAIL');
  process.exit(rep.pass ? 0 : 1);
}
