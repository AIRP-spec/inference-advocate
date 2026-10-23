// Shared-encoding model, Node integration: pins, decode identity, feed hash, refusal on mismatch,
// engine dispatch, and the live cross-path test.
//
// The live test runs the fixed held-out items (laya-shared-node/crosspath/fixed-items-shared.json) through
// the Python gate path (python_ref_shared.py, the 3b onnx_raw.py/bench_shared.py path) and the shipped Node
// path (LayaSharedLocalEvaluator via node_path_shared.mjs) and requires identical primitives, identical
// composed verdicts AND identical feed tensors (SHA-256 of input_ids) on every item. It needs the 1.7 GB
// pinned bundle, so it runs when AIRP_LAYA_SHARED_BUNDLE_DIR and AIRP_LAYA_PYTHON are set; with
// AIRP_LAYA_CROSSPATH_REQUIRED=1 a missing bundle is a failure, not a skip.
// The model-free tests always run.

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
const L = join(here, 'laya-shared-node');
const { compose, layaPrimitivesFromLogits, validateLayaSharedPins, LayaSharedLocalEvaluator, sharedFeedSha256, createOnDeviceEvaluator, createLocalEvaluator } = await import(
  join(repo, 'packages/evaluator-local/dist/index.js')
);
const { Taxonomy } = await import(join(repo, 'packages/core/dist/index.js'));
const { comparePaths } = await import(join(here, 'laya-node/crosspath/compare.mjs'));

const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const PINS = join(L, 'pins/laya-shared-avg-f05-s14-fp32.pins.json');
const SHARED_CONFIG = join(L, 'pins/shared_config-avg-f05-s14.json');
const COMPOSITION = join(repo, 'tools/evaluator-training/primitives/compositions/airp-v0.5.0-cse-corrected-2a.json');
const SUITE = join(repo, 'data/evaluator-gate/held-out-suite.v2.json');
const FIXED = join(L, 'crosspath/fixed-items-shared.json');
const GOLDEN = join(L, 'crosspath/golden-python-shared-fixed.jsonl');
const PINNED = {
  pins: '7d3ec1cb494aebf81703fe29963cf31a1621ffdcfb81fbd2da04708398db1158',
  onnx: '90b24a0b1ce9b3b3ab0b47a9120c383aafa134c24ceb4b1bd79a451ac5cf8798',
  sharedConfig: 'ccacd35480bdd71d6e5b833dd296212848d167a30000f689468e81d3e207cb03',
  tokenizer: '6c8aaa9a542084f2457eab775d4eeb51f92a70c0fd9de28d5edb0ddec3c08d30',
  questions: 'f519fa8e4763cc95acef3d134f984941c263043bad4abfd2a827c69e560650ee',
  composition: '59ddf1f630ec2dcd81d40dd01f2adb53f1310fe42128d3ccc9b90de61e28ab9e',
  suite: '6c7b30e16b8ab53544f590bcbbdcd381f32e3e4cf324e225e2e8c489cebb28e4',
};
const pins = JSON.parse(readFileSync(PINS, 'utf8'));
const composition = JSON.parse(readFileSync(COMPOSITION, 'utf8'));
const rows = (p) => readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

test('laya-shared pins: file, graph, shared_config, tokenizer, questions and composition SHAs are the pinned ones', () => {
  assert.equal(sha(PINS), PINNED.pins);
  assert.equal(pins.onnx.sha256, PINNED.onnx);
  assert.equal(pins.bundle['shared_config.json'], PINNED.sharedConfig);
  assert.equal(sha(SHARED_CONFIG), PINNED.sharedConfig);
  assert.equal(pins.bundle['tokenizer/tokenizer.json'], PINNED.tokenizer);
  assert.equal(pins.questions.sha256, PINNED.questions);
  assert.equal(sha(join(repo, pins.questions.file)), PINNED.questions);
  assert.equal(pins.composition.sha256, PINNED.composition);
  assert.equal(sha(COMPOSITION), PINNED.composition);
  const sc = JSON.parse(readFileSync(SHARED_CONFIG, 'utf8'));
  assert.deepEqual(pins.heads.order, sc.qids);
  assert.deepEqual(pins.heads.widths, sc.widths);
  assert.equal(pins.maxLen, sc.max_len);
  assert.equal(pins.temperature.noul, 1);
  assert.equal(pins.temperature.choice, 1);
  assert.ok(Object.values(pins.thresholds.noul).every((t) => t === 0.5));
  assert.deepEqual(pins.ort, { allowSpinning: false });
  validateLayaSharedPins(pins);
});

test('laya-shared decode: Node decode on the Python-path logits reproduces the Python decisions on the fixed items', () => {
  const fixed = JSON.parse(readFileSync(FIXED, 'utf8'));
  assert.equal(fixed.suiteSha256, PINNED.suite);
  assert.equal(sha(SUITE), PINNED.suite);
  const golden = rows(GOLDEN);
  assert.deepEqual(golden.map((r) => r.id), fixed.ids);
  const composedKinds = new Set();
  for (const r of golden) {
    const d = layaPrimitivesFromLogits(r.logits, pins);
    assert.deepEqual({ stance: d.stance, objects: d.objects, qualifiers: d.qualifiers }, r.prims, r.id);
    composedKinds.add(JSON.stringify(compose(d, composition)));
  }
  assert.ok(composedKinds.size > 3, 'the fixed items should cover several composed verdicts');
});

test('laya-shared feed hash: Node sharedFeedSha256 equals the Python feed_sha256 bytes', () => {
  // Python: sha256(b"input_ids:1x4:" + np.asarray([50281, 12092, 1533, 50282], "<i8").tobytes())
  assert.equal(sharedFeedSha256(new BigInt64Array([50281n, 12092n, 1533n, 50282n])), '1730e115babac974b88e33fc9d66f2c27d921735c28d33d6ed3bc5f2371921f1');
});

function fakeBundle({ onnxClaim, pinsPatch = {}, configPatch = {} }) {
  const dir = mkdtempSync(join(tmpdir(), 'laya-shared-pins-'));
  mkdirSync(join(dir, 'bundle/tokenizer'), { recursive: true });
  writeFileSync(join(dir, 'bundle/laya-shared.onnx'), 'not the pinned graph');
  const sc = { ...JSON.parse(readFileSync(SHARED_CONFIG, 'utf8')), ...configPatch };
  writeFileSync(join(dir, 'bundle/shared_config.json'), JSON.stringify(sc));
  writeFileSync(join(dir, 'bundle/tokenizer/tokenizer.json'), '{}');
  writeFileSync(join(dir, 'bundle/tokenizer/tokenizer_config.json'), '{}');
  const bundle = { 'shared_config.json': sha(join(dir, 'bundle/shared_config.json')), 'tokenizer/tokenizer.json': sha(join(dir, 'bundle/tokenizer/tokenizer.json')), 'tokenizer/tokenizer_config.json': sha(join(dir, 'bundle/tokenizer/tokenizer_config.json')) };
  const p = { ...pins, onnx: { ...pins.onnx, sha256: onnxClaim }, bundle, ...pinsPatch };
  writeFileSync(join(dir, 'pins.json'), JSON.stringify(p));
  return { dir, pinsPath: join(dir, 'pins.json'), pinsSha256: sha(join(dir, 'pins.json')), modelPath: join(dir, 'bundle/laya-shared.onnx') };
}

test('laya-shared evaluator refuses to start on a model, pins, bundle or composition mismatch', () => {
  const taxonomy = Taxonomy.loadFromFile(join(repo, 'data/taxonomy/flags.v0.json'));
  const base = { taxonomy, compositionPath: COMPOSITION, compositionSha256: PINNED.composition };
  const b = fakeBundle({ onnxClaim: PINNED.onnx });
  const ok = { ...base, modelPath: b.modelPath, modelSha256: PINNED.onnx, pinsPath: b.pinsPath, pinsSha256: b.pinsSha256 };
  assert.throws(() => new LayaSharedLocalEvaluator(ok), /digest mismatch/);                                         // graph on disk is not the pinned one
  assert.throws(() => new LayaSharedLocalEvaluator({ ...ok, pinsSha256: PINNED.pins }), /pins digest mismatch/);     // pins edited, config SHA not
  assert.throws(() => new LayaSharedLocalEvaluator({ ...ok, modelSha256: 'ab'.repeat(32) }), /does not match the pins/);
  assert.throws(() => new LayaSharedLocalEvaluator({ ...ok, compositionSha256: 'cd'.repeat(32) }), /composition/);
  assert.throws(() => new LayaSharedLocalEvaluator({ ...ok, modelPath: join(b.dir, 'bundle/laya.onnx') }), /must name laya-shared\.onnx/);
  writeFileSync(join(b.dir, 'bundle/tokenizer/tokenizer.json'), '{"edited":true}');
  assert.throws(() => new LayaSharedLocalEvaluator(ok), /bundle file tokenizer\/tokenizer\.json/);              // tokenizer swapped
  const t = fakeBundle({ onnxClaim: PINNED.onnx, pinsPatch: { thresholds: { ...pins.thresholds, noul: { profanity: 0.5 } } } });
  assert.throws(() => new LayaSharedLocalEvaluator({ ...base, modelPath: t.modelPath, modelSha256: PINNED.onnx, pinsPath: t.pinsPath, pinsSha256: t.pinsSha256 }), /threshold/);
  const s = fakeBundle({ onnxClaim: PINNED.onnx, pinsPatch: { ort: { allowSpinning: true } } });
  assert.throws(() => new LayaSharedLocalEvaluator({ ...base, modelPath: s.modelPath, modelSha256: PINNED.onnx, pinsPath: s.pinsPath, pinsSha256: s.pinsSha256 }), /allowSpinning/);
  const h = fakeBundle({ onnxClaim: PINNED.onnx, configPatch: { qids: [...pins.heads.order].reverse() } });
  assert.throws(() => new LayaSharedLocalEvaluator({ ...base, modelPath: h.modelPath, modelSha256: PINNED.onnx, pinsPath: h.pinsPath, pinsSha256: h.pinsSha256 }), /head order/);
});

test('engine dispatch: laya-shared-onnx reaches the shared evaluator (and its pin checks); the GGUF constructor refuses it', async () => {
  const taxonomy = Taxonomy.loadFromFile(join(repo, 'data/taxonomy/flags.v0.json'));
  const b = fakeBundle({ onnxClaim: PINNED.onnx });
  const cfg = { kind: 'local', engine: 'laya-shared-onnx', modelPath: b.modelPath, modelSha256: PINNED.onnx,
    laya: { pinsPath: b.pinsPath, pinsSha256: b.pinsSha256, compositionPath: COMPOSITION, compositionSha256: PINNED.composition } };
  await assert.rejects(() => createOnDeviceEvaluator(cfg, taxonomy), /local evaluator model digest mismatch for laya-shared\.onnx/);
  await assert.rejects(() => createLocalEvaluator(cfg, taxonomy), /builds the GGUF engine/);
});

const bundle = process.env.AIRP_LAYA_SHARED_BUNDLE_DIR;
const python = process.env.AIRP_LAYA_PYTHON;
const required = process.env.AIRP_LAYA_CROSSPATH_REQUIRED === '1';

test('laya-shared cross-path: Python gate path and Node agree item by item on the fixed held-out items, feed included', (t) => {
  if (!bundle || !python || !existsSync(join(bundle ?? '', 'laya-shared.onnx'))) {
    const msg = 'laya-shared cross-path live test needs AIRP_LAYA_SHARED_BUNDLE_DIR and AIRP_LAYA_PYTHON (pinned bundle, 1.7 GB); not run';
    if (required) assert.fail(msg);
    console.log(`notice: ${msg}`);
    t.skip(msg);
    return;
  }
  const out = mkdtempSync(join(tmpdir(), 'laya-shared-crosspath-'));
  const common = ['--bundle', bundle, '--pins', PINS, '--pins-sha', PINNED.pins, '--suite', SUITE, '--ids', FIXED];
  execFileSync(python, [join(L, 'crosspath/python_ref_shared.py'), ...common, '--out', join(out, 'python.jsonl')], { stdio: 'inherit' });
  execFileSync(process.execPath, [join(L, 'crosspath/node_path_shared.mjs'), ...common, '--composition', COMPOSITION,
    '--composition-sha', PINNED.composition, '--out', join(out, 'node.jsonl'), '--summary', join(out, 'node-summary.json')], { stdio: 'inherit' });
  const rep = comparePaths(rows(join(out, 'python.jsonl')), rows(join(out, 'node.jsonl')), pins, composition);
  writeFileSync(join(out, 'compare.json'), JSON.stringify(rep, null, 1));
  const n = JSON.parse(readFileSync(FIXED, 'utf8')).ids.length;
  assert.equal(rep.n, n);
  assert.equal(rep.primsIdentical, n);
  assert.equal(rep.composedIdentical, n);
  assert.equal(rep.feedChecked, n);
  assert.equal(rep.feedIdentical, n);
  assert.deepEqual(rep.problems, []);
  assert.ok(rep.pass);
});
