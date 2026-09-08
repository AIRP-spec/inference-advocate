#!/usr/bin/env node
// Gate every sweep checkpoint through the real LocalEvaluator v3 path.
//
// Paper: step 8. Provisional Section 3.3. Scoring is not reimplemented.
// This script invokes gate.mjs once per checkpoint. A FAIL is recorded,
// not skipped. The live evaluator is not flipped.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const sweepRecipe = JSON.parse(readFileSync(join(here, 'sweep-recipe.json'), 'utf8'));

function parseArgs(argv) {
  const out = { gpu: false };
  for (const a of argv.slice(2)) {
    if (a === '--gpu') out.gpu = true;
    else throw new Error(`unknown argument ${a}`);
  }
  return out;
}

function run(label, cmd, cmdArgs) {
  console.log(`\n== ${label} ==`);
  console.log('+', cmd, cmdArgs.join(' '));
  const result = spawnSync(cmd, cmdArgs, { cwd: repoRoot, stdio: 'inherit', env: process.env });
  if (result.status !== 0 && result.status !== 2) {
    console.error(`${label} failed with status ${result.status ?? 'null'}`);
    process.exit(result.status ?? 1);
  }
  return result.status ?? 1;
}

const args = parseArgs(process.argv);
const outDir = join(repoRoot, sweepRecipe.outputs.dir);
const ckptPath = join(outDir, sweepRecipe.outputs.checkpoints);
if (!existsSync(ckptPath)) {
  console.error(`no checkpoints at ${ckptPath}. Train the sweep first.`);
  process.exit(1);
}
const payload = JSON.parse(readFileSync(ckptPath, 'utf8'));
const rows = payload.checkpoints || [];
if (rows.length < sweepRecipe.sweep.minCheckpoints) {
  console.error(
    `checkpoints.json has ${rows.length} rows, recipe minCheckpoints is ${sweepRecipe.sweep.minCheckpoints}`,
  );
  process.exit(1);
}

let failedHard = 0;
for (const row of rows) {
  if (!row.ggufPath || !existsSync(row.ggufPath)) {
    console.error(`checkpoint step ${row.step} has no GGUF at ${row.ggufPath || '(empty)'}`);
    process.exit(1);
  }
  const report = join(outDir, `gate-report-step-${row.step}.json`);
  const gateArgs = [
    join(here, 'gate.mjs'),
    '--gguf',
    row.ggufPath,
    '--report',
    report,
    '--allow-fail',
  ];
  if (row.ggufSha256) {
    gateArgs.push('--sha256', row.ggufSha256);
  }
  if (args.gpu) gateArgs.push('--gpu');
  const status = run(`gate step ${row.step} epoch ${row.epoch}`, process.execPath, gateArgs);
  if (status !== 0) failedHard += 1;
  row.gateReport = report;
  if (row.ggufPath && existsSync(row.ggufPath)) {
    unlinkSync(row.ggufPath);
    console.log(`deleted ${row.ggufPath}`);
    row.ggufPath = null;
  }
}

if (failedHard) {
  console.error(`sweep-gate: ${failedHard} checkpoint(s) did not produce a report`);
  process.exit(1);
}

writeFileSync(ckptPath, JSON.stringify(payload, null, 2) + '\n');
console.log(`gated ${rows.length} checkpoints. Report next: node tools/evaluator-training/sweep-report.mjs`);
