#!/usr/bin/env node
// Run the held-out gate on a trained GGUF through LocalEvaluator at template v3.
//
// Paper: step 8. Provisional Section 3.3. The suite is the publication criterion.
// This is not a training-time proxy: it constructs LocalEvaluator with
// promptTemplateVersion v3 and calls evaluate() per item. A failing report
// is not published. The live default evaluator is not changed.

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const trainRecipe = JSON.parse(readFileSync(join(here, 'train-recipe.json'), 'utf8'));
const genRecipe = JSON.parse(readFileSync(join(here, 'recipe.json'), 'utf8'));

function parseArgs(argv) {
  const out = { gguf: '', sha256: '', gpu: false, report: '', allowFail: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--gpu') out.gpu = true;
    else if (a === '--allow-fail') out.allowFail = true;
    else if (a === '--gguf') out.gguf = argv[++i];
    else if (a === '--sha256') out.sha256 = argv[++i];
    else if (a === '--report') out.report = argv[++i];
    else throw new Error(`unknown argument ${a}`);
  }
  return out;
}

function hardwareStatement() {
  let lscpu = '';
  try {
    lscpu = execSync('lscpu', { encoding: 'utf8' });
  } catch {
    return 'lscpu unavailable';
  }
  const pick = (label) => {
    const line = lscpu.split('\n').find((l) => l.startsWith(label));
    return line ? line.split(':').slice(1).join(':').trim() : 'unknown';
  };
  const flags = pick('Flags');
  const has = (name) => (flags.split(/\s+/).includes(name) ? 'present' : 'absent');
  return [
    `CPU ${pick('Model name')}`,
    `${pick('CPU(s)')} cores`,
    `avx2 ${has('avx2')}`,
    `avx512f ${has('avx512f')}`,
    `fma ${has('fma')}`,
  ].join(', ');
}

const args = parseArgs(process.argv);
const artifactsPath = join(repoRoot, trainRecipe.outputs.dir, trainRecipe.outputs.manifest);
let artifacts = {};
if (existsSync(artifactsPath)) {
  artifacts = JSON.parse(readFileSync(artifactsPath, 'utf8'));
}
const ggufPath = resolve(args.gguf || artifacts.ggufPath || '');
if (!ggufPath || !existsSync(ggufPath)) {
  console.error(`gate: no GGUF at ${ggufPath || '(empty)'}. Train first.`);
  process.exit(1);
}

let Taxonomy;
let LocalEvaluator;
let loadHeldOutSuiteFromFile;
let loadGateConfigFromFile;
let scoreHeldOutGate;
let scoreHeldOutGateDual;
let sha256FileHex;
let PROMPT_TEMPLATE_V3;
try {
  ({ Taxonomy } = await import('@airp/core'));
  ({
    LocalEvaluator,
    loadHeldOutSuiteFromFile,
    loadGateConfigFromFile,
    scoreHeldOutGate,
    scoreHeldOutGateDual,
    sha256FileHex,
    PROMPT_TEMPLATE_V3,
  } = await import('@airp/evaluator-local'));
} catch (err) {
  console.error(`cannot import built packages (${err.message}). Run npm run build first.`);
  process.exit(1);
}

if (PROMPT_TEMPLATE_V3 !== trainRecipe.promptTemplateVersion) {
  console.error(`PROMPT_TEMPLATE_V3 is ${PROMPT_TEMPLATE_V3}, train-recipe wants v3`);
  process.exit(1);
}

const digest = args.sha256 || sha256FileHex(ggufPath);
if (args.sha256 && digest !== sha256FileHex(ggufPath)) {
  console.error(`GGUF digest ${sha256FileHex(ggufPath)} != --sha256 ${args.sha256}`);
  process.exit(1);
}
if (!args.gguf && artifacts.ggufSha256 && digest !== artifacts.ggufSha256) {
  console.error(`GGUF digest ${digest} != artifacts ${artifacts.ggufSha256}`);
  process.exit(1);
}

const taxonomy = Taxonomy.loadFromFile(join(repoRoot, genRecipe.taxonomyFile));
const suitePath = join(repoRoot, genRecipe.heldOutSuite);
const gatePath = join(repoRoot, 'data/evaluator-gate/gate.json');
const suite = loadHeldOutSuiteFromFile(suitePath);
const gate = loadGateConfigFromFile(gatePath);
if (sha256FileHex(suitePath) !== gate.suiteSha256) {
  console.error('held-out suite digest does not match gate.json');
  process.exit(1);
}
if (gate.appliesWhen.promptTemplateVersion !== 'v3') {
  console.error(`gate appliesWhen is ${gate.appliesWhen.promptTemplateVersion}, not v3`);
  process.exit(1);
}

const evaluator = new LocalEvaluator({
  taxonomy,
  modelPath: ggufPath,
  modelSha256: digest,
  gpu: args.gpu,
  promptTemplateVersion: 'v3',
});
await evaluator.load();

const pin = `local-llm@${digest.slice(0, 12)}+v3`;
const hardware = hardwareStatement();
console.log(`pin ${pin}`);
console.log(`hardware: ${hardware}`);
console.log(`llama.cpp: ${evaluator.systemInfo || '(empty system-info)'}`);
console.log(`held-out gate: ${suite.items.length} items, extra-class limit ${gate.rules.maxSuiteExtraClassFires.value}`);
console.log('v3 evidence is empty by construction (the trained task is the compact verdict).');

const verdicts = [];
for (const item of suite.items) {
  const flags = await evaluator.evaluate({
    providerId: 'held-out',
    content: item.content,
    prompt: item.prompt,
  });
  const got = flags.map((f) => f.type);
  verdicts.push({ id: item.id, got, ms: evaluator.lastEvalMs });
  const extra = got.filter((type) => !item.expect.includes(type));
  const missing = item.expect.filter((type) => !got.includes(type));
  const mark = missing.length === 0 && extra.length === 0 ? 'pass' : 'FAIL';
  console.log(
    `  ${item.id.padEnd(42)} ${item.kind.padEnd(10)} ${mark}  got=[${got.join(', ') || 'none'}]  ${evaluator.lastEvalMs}ms` +
      (missing.length ? `  missing=[${missing.join(', ')}]` : '') +
      (extra.length ? `  extra=[${extra.join(', ')}]` : ''),
  );
}

const dualScore = scoreHeldOutGateDual(suite, gate, verdicts, suitePath);
const score = dualScore.full;
const historicalScore = dualScore.historicalSubset;
const types = taxonomy.flags.map((f) => f.type);
const perClass = types.map((type) => {
  const scoped = suite.items.filter((item) => item.expect.includes(type));
  const rows = scoped.map((item) => score.rows.find((r) => r.id === item.id));
  const missed = rows.filter((r) => r.missing.includes(type));
  const extras = score.rows.filter((r) => r.extra.includes(type));
  return {
    type,
    n: scoped.length,
    missed: missed.length,
    extra: extras.length,
    pass: missed.length === 0 && extras.length === 0,
  };
});
const clean = suite.items.filter((item) => item.expect.length === 0);
const cleanFires = clean.filter((item) => {
  const row = score.rows.find((r) => r.id === item.id);
  return row.extra.length > 0;
});

console.log('per-class:');
for (const row of perClass) {
  console.log(
    `  ${row.type.padEnd(28)} n=${String(row.n).padStart(3)}  missed=${row.missed}  extra=${row.extra}  ${row.pass ? 'pass' : 'FAIL'}`,
  );
}
console.log(
  `clean traffic: ${clean.length} items, ${cleanFires.length} fired anything (limit 0 extra-class fires across the suite)`,
);
console.log(
  `wall time: mean ${score.meanMs}ms, clean-path mean ${score.meanCleanPathMs}ms, fire-path mean ${score.meanFirePathMs}ms, n=${score.n}`,
);
console.log(`precision (gating): ${score.extraClassFires} extra-class fires, limit ${score.extraLimit}`);
console.log(`recall (gating): ${score.recallFailures.length} items missed an expected class`);
console.log(`gate ${score.pass ? 'PASS' : 'FAIL'}  ${pin}`);

if (historicalScore) {
  console.log(`\nhistorical subset (${gate.historicalSubset.name}, n=${historicalScore.n}):`);
  console.log(`  precision: ${historicalScore.extraClassFires} extra-class fires, limit ${historicalScore.extraLimit}`);
  console.log(`  recall: ${historicalScore.recallFailures.length} items missed an expected class`);
  console.log(`  gate ${historicalScore.pass ? 'PASS' : 'FAIL'}`);
  console.log(`  wall time: mean ${historicalScore.meanMs}ms, clean-path mean ${historicalScore.meanCleanPathMs}ms, fire-path mean ${historicalScore.meanFirePathMs}ms`);
}

const report = {
  pass: score.pass,
  pin,
  digest,
  ggufPath,
  promptTemplateVersion: 'v3',
  hardware,
  systemInfo: evaluator.systemInfo,
  n: score.n,
  extraClassFires: score.extraClassFires,
  extraLimit: score.extraLimit,
  precisionPass: score.precisionPass,
  recallFailures: score.recallFailures.map((r) => ({ id: r.id, missing: r.missing, extra: r.extra })),
  extraRows: score.rows.filter((r) => r.extra.length > 0).map((r) => ({ id: r.id, extra: r.extra, missing: r.missing })),
  meanMs: score.meanMs,
  meanCleanPathMs: score.meanCleanPathMs,
  meanFirePathMs: score.meanFirePathMs,
  perClass,
  cleanFires: cleanFires.map((item) => item.id),
  evidence: 'empty on v3; compact verdict only',
  historicalSubset: historicalScore ? {
    name: gate.historicalSubset.name,
    n: historicalScore.n,
    extraClassFires: historicalScore.extraClassFires,
    extraLimit: historicalScore.extraLimit,
    precisionPass: historicalScore.precisionPass,
    recallFailures: historicalScore.recallFailures.map((r) => ({ id: r.id, missing: r.missing, extra: r.extra })),
    extraRows: historicalScore.rows.filter((r) => r.extra.length > 0).map((r) => ({ id: r.id, extra: r.extra, missing: r.missing })),
    meanMs: historicalScore.meanMs,
    meanCleanPathMs: historicalScore.meanCleanPathMs,
    meanFirePathMs: historicalScore.meanFirePathMs,
    pass: historicalScore.pass,
  } : null,
};
const reportPath =
  args.report ||
  (args.gguf
    ? join(dirname(ggufPath), `gate-report-step.json`)
    : join(repoRoot, trainRecipe.outputs.dir, trainRecipe.outputs.gateReport));
writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(`wrote ${reportPath}`);
if (!score.pass) {
  console.error('gate failed. Do not publish. Paste this report (or gate-report.json) for the failure pattern.');
  if (!args.allowFail) process.exit(2);
  console.error('--allow-fail: report written, continuing.');
} else {
  console.log('gate passed. Publish is a separate step: node tools/evaluator-training/publish.mjs');
}
