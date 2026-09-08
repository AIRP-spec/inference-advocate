#!/usr/bin/env node
// Kick off the diagnostic checkpoint sweep: leak-check, sft-v3 assert,
// train with interval checkpoints, then merge-GGUF-gate-delete each
// checkpoint and write the curve report.
//
// Paper: step 8. Commit this script before the GPU run so the run is a
// reproduction of the tree, not an ad-hoc notebook. This sequence does not
// publish. The live evaluator is not flipped. Corpus, taxonomy, and gate
// thresholds are unchanged. Large weights do not accumulate: after each
// checkpoint is gated, the merged bf16 directory and that GGUF are deleted.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const sweepRecipe = JSON.parse(readFileSync(join(here, 'sweep-recipe.json'), 'utf8'));

function parseArgs(argv) {
  const out = {
    skipPreflight: false,
    skipTrain: false,
    skipGate: false,
    skipGguf: false,
    skipExport: false,
    gpu: false,
  };
  for (const a of argv.slice(2)) {
    if (a === '--skip-preflight') out.skipPreflight = true;
    else if (a === '--skip-train') out.skipTrain = true;
    else if (a === '--skip-gate') out.skipGate = true;
    else if (a === '--skip-gguf') out.skipGguf = true;
    else if (a === '--skip-export-checkpoints') out.skipExport = true;
    else if (a === '--gpu') out.gpu = true;
    else throw new Error(`unknown argument ${a}`);
  }
  return out;
}

function run(label, cmd, cmdArgs) {
  console.log(`\n== ${label} ==`);
  console.log('+', cmd, cmdArgs.join(' '));
  const result = spawnSync(cmd, cmdArgs, { cwd: repoRoot, stdio: 'inherit', env: process.env });
  if (result.status !== 0) {
    console.error(`${label} failed with status ${result.status ?? 'null'}`);
    process.exit(result.status ?? 1);
  }
}

const args = parseArgs(process.argv);
if (sweepRecipe.sft.includes('held-out')) {
  console.error('sweep recipe training input must not be the held-out suite');
  process.exit(1);
}
if (!args.skipPreflight) {
  run('leak-check', process.execPath, [join(here, 'leak-check.mjs')]);
  run('assert-sft-v3', process.execPath, [join(here, 'assert-sft-v3.mjs')]);
}
if (!args.skipTrain) {
  const py = process.env.AIRP_TRAIN_PYTHON || 'python3';
  const trainArgs = [join(here, 'train.py'), '--recipe', join(here, 'sweep-recipe.json')];
  if (args.skipGguf) trainArgs.push('--skip-gguf');
  trainArgs.push('--skip-export-checkpoints');
  run('train-sweep', py, trainArgs);
}
if (!args.skipGate) {
  const ckptPath = join(repoRoot, sweepRecipe.outputs.dir, sweepRecipe.outputs.checkpoints);
  const loraDir = join(repoRoot, sweepRecipe.outputs.dir, sweepRecipe.outputs.adapter);
  if (!existsSync(ckptPath) && !existsSync(loraDir)) {
    console.error(`no checkpoints at ${ckptPath} and no adapters at ${loraDir}`);
    process.exit(1);
  }
  const py = process.env.AIRP_TRAIN_PYTHON || 'python3';
  const gateArgs = [join(here, 'gate-from-adapters.py')];
  if (args.gpu) gateArgs.push('--gpu');
  run('sweep-gate', py, gateArgs);
  run('sweep-report', process.execPath, [join(here, 'sweep-report.mjs')]);
}
