// Laya Node integration: pins, decode identity, refusal on mismatch, and the cross-path test.
//
// Gating ran in Python; users run Node. The live cross-path test runs the same fixed held-out
// items (laya-node/crosspath/fixed-items.json) through the Python gate path (python_ref.py) and
// the shipped Node path (LayaLocalEvaluator via node_path.mjs) and requires identical primitives
// AND identical composed verdicts on every item. It needs the 1.7 GB pinned bundle, so it runs
// when AIRP_LAYA_BUNDLE_DIR (bundle dir) and AIRP_LAYA_PYTHON (python with laya 0.3.21,
// transformers, onnxruntime) are set. With AIRP_LAYA_CROSSPATH_REQUIRED=1 a missing bundle is a
// failure, not a skip: the laya-crosspath CI job sets it.
//
// The model-free tests always run: pin SHAs, the Node decode applied to the committed Python-path
// golden logits reproduces the Python decisions, and the evaluator refuses mismatched pins.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const L = join(here, 'laya-node');
const { compose, layaPrimitivesFromLogits, validateLayaPins, LayaLocalEvaluator } = await import(
  join(repo, 'packages/evaluator-local/dist/index.js')
);
const { Taxonomy } = await import(join(repo, 'packages/core/dist/index.js'));
const { comparePaths } = await import(join(L, 'crosspath/compare.mjs'));

const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const PINS = join(L, 'pins/laya-5766-fp32.pins.json');
const COMPOSITION = join(repo, 'tools/evaluator-training/primitives/compositions/airp-v0.5.0.json');
const SUITE = join(repo, 'data/evaluator-gate/held-out-suite.v2.json');
const FIXED = join(L, 'crosspath/fixed-items.json');
const GOLDEN = join(L, 'crosspath/golden-python-fixed.jsonl');
const PINNED = {
  pins: 'b0c9dd23bb71233db4026d6531fa1484c0f8b64b307ac1bd3b7330a911f1edbd',
  questions: 'f519fa8e4763cc95acef3d134f984941c263043bad4abfd2a827c69e560650ee',
  onnx: '0b5694036a20f3093f2cac7c8f6d8569400756e9982a28ccd4070997a522aa8e',
  composition: '4def0b8fd339713bd261106cb10235949f4bd1bc4e3631a88dd7cc511b0087e0',
  suite: '6c7b30e16b8ab53544f590bcbbdcd381f32e3e4cf324e225e2e8c489cebb28e4',
};
const pins = JSON.parse(readFileSync(PINS, 'utf8'));
const composition = JSON.parse(readFileSync(COMPOSITION, 'utf8'));
const rows = (p) => readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

test('laya pins: file, questions, composition and model SHAs are the pinned ones', () => {
  assert.equal(sha(PINS), PINNED.pins);
  assert.equal(sha(join(L, 'pins/laya-questions.json')), PINNED.questions);
  assert.equal(pins.questions.sha256, PINNED.questions);
  // Wording and key order: the definitions inside the pins are the trainpack questions file.
  assert.equal(JSON.stringify(pins.questions.definitions), JSON.stringify(JSON.parse(readFileSync(join(L, 'pins/laya-questions.json'), 'utf8'))));
  assert.equal(pins.onnx.sha256, PINNED.onnx);
  assert.equal(pins.composition.sha256, PINNED.composition);
  assert.equal(sha(COMPOSITION), PINNED.composition);
  assert.equal(pins.bundle['laya_config.json'], sha(join(L, 'pins/laya_config.json')));
  assert.deepEqual(pins.temperature.noul, 1);
  assert.deepEqual(pins.temperature.choice, 1);
  assert.ok(Object.values(pins.thresholds.noul).every((t) => t === 0.5));
  validateLayaPins(pins);
});

test('laya decode: Node decode on the Python-path logits reproduces the Python decisions and composed verdicts', () => {
  const fixed = JSON.parse(readFileSync(FIXED, 'utf8'));
  assert.equal(fixed.suiteSha256, PINNED.suite);
  assert.equal(sha(SUITE), PINNED.suite);
  const golden = rows(GOLDEN);
  assert.deepEqual(golden.map((r) => r.id), fixed.ids);
  for (const r of golden) {
    const d = layaPrimitivesFromLogits(r.logits, pins);
    assert.deepEqual({ stance: d.stance, objects: d.objects, qualifiers: d.qualifiers }, r.prims, r.id);
    assert.deepEqual(compose(d, composition), r.composed, r.id);
  }
});

function fakeBundle({ onnxClaim, pinsPatch = {} }) {
  const dir = mkdtempSync(join(tmpdir(), 'laya-pins-'));
  mkdirSync(join(dir, 'bundle'));
  writeFileSync(join(dir, 'bundle/laya.onnx'), 'not the pinned graph');
  writeFileSync(join(dir, 'bundle/laya_config.json'), readFileSync(join(L, 'pins/laya_config.json')));
  const p = { ...pins, onnx: { ...pins.onnx, sha256: onnxClaim }, bundle: { 'laya_config.json': pins.bundle['laya_config.json'] }, ...pinsPatch };
  writeFileSync(join(dir, 'pins.json'), JSON.stringify(p));
  return { dir, pinsPath: join(dir, 'pins.json'), pinsSha256: sha(join(dir, 'pins.json')), modelPath: join(dir, 'bundle/laya.onnx') };
}

test('laya evaluator refuses to start on a model, pins or composition mismatch', () => {
  const taxonomy = Taxonomy.loadFromFile(join(repo, 'data/taxonomy/flags.v0.json'));
  const base = { taxonomy, compositionPath: COMPOSITION, compositionSha256: PINNED.composition };
  const b = fakeBundle({ onnxClaim: PINNED.onnx });
  // Pins and config agree on the pinned graph, the file on disk is not it.
  assert.throws(() => new LayaLocalEvaluator({ ...base, modelPath: b.modelPath, modelSha256: PINNED.onnx, pinsPath: b.pinsPath, pinsSha256: b.pinsSha256 }), /digest mismatch/);
  // Pins file edited (e.g. a threshold) without updating the config SHA.
  assert.throws(() => new LayaLocalEvaluator({ ...base, modelPath: b.modelPath, modelSha256: PINNED.onnx, pinsPath: b.pinsPath, pinsSha256: PINNED.pins }), /pins digest mismatch/);
  // Config names a different model than the pins.
  assert.throws(() => new LayaLocalEvaluator({ ...base, modelPath: b.modelPath, modelSha256: 'ab'.repeat(32), pinsPath: b.pinsPath, pinsSha256: b.pinsSha256 }), /does not match the pins/);
  // Composition SHA differs.
  assert.throws(() => new LayaLocalEvaluator({ ...base, compositionSha256: 'cd'.repeat(32), modelPath: b.modelPath, modelSha256: PINNED.onnx, pinsPath: b.pinsPath, pinsSha256: b.pinsSha256 }), /composition/);
  // Thresholds missing a primitive.
  const t = fakeBundle({ onnxClaim: PINNED.onnx, pinsPatch: { thresholds: { ...pins.thresholds, noul: { profanity: 0.5 } } } });
  assert.throws(() => new LayaLocalEvaluator({ ...base, modelPath: t.modelPath, modelSha256: PINNED.onnx, pinsPath: t.pinsPath, pinsSha256: t.pinsSha256 }), /threshold/);
});

const bundleDir = process.env.AIRP_LAYA_BUNDLE_DIR;
const python = process.env.AIRP_LAYA_PYTHON;
const required = process.env.AIRP_LAYA_CROSSPATH_REQUIRED === '1';

test('laya cross-path: Python gate path and Node shipped path agree item by item on the fixed held-out items', (t) => {
  if (!bundleDir || !python || !existsSync(join(bundleDir ?? '', 'laya.onnx'))) {
    const msg = 'laya cross-path live test needs AIRP_LAYA_BUNDLE_DIR and AIRP_LAYA_PYTHON (pinned 1.7 GB bundle); not run';
    if (required) assert.fail(msg);
    console.log(`notice: ${msg}`);
    t.skip(msg);
    return;
  }
  const out = mkdtempSync(join(tmpdir(), 'laya-crosspath-'));
  const common = ['--bundle', bundleDir, '--pins', PINS, '--pins-sha', PINNED.pins, '--suite', SUITE, '--ids', FIXED];
  execFileSync(python, [join(L, 'crosspath/python_ref.py'), ...common, '--out', join(out, 'python.jsonl')], { stdio: 'inherit' });
  execFileSync(process.execPath, [join(L, 'crosspath/node_path.mjs'), ...common, '--composition', COMPOSITION,
    '--composition-sha', PINNED.composition, '--out', join(out, 'node.jsonl'), '--summary', join(out, 'node-summary.json')], { stdio: 'inherit' });
  const rep = comparePaths(rows(join(out, 'python.jsonl')), rows(join(out, 'node.jsonl')), pins, composition);
  writeFileSync(join(out, 'compare.json'), JSON.stringify(rep, null, 1));
  console.log(`laya cross-path: n=${rep.n} prims identical ${rep.primsIdentical}, composed identical ${rep.composedIdentical}, max|dlogit| ${rep.maxAbsLogitDiff}; report ${join(out, 'compare.json')}`);
  assert.equal(rep.n, JSON.parse(readFileSync(FIXED, 'utf8')).ids.length);
  assert.deepEqual(rep.problems, []);
  assert.ok(rep.pass);
});
