#!/usr/bin/env node
// Kick off the LoRA run: leak-check, sft-v3 assert, train, then the held-out gate.
//
// Paper: step 8. Commit this script before the GPU run so the run is a
// reproduction of the tree, not an ad-hoc notebook. Publish is not in this
// sequence. The live evaluator is not flipped.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const trainRecipe = JSON.parse(readFileSync(join(here, 'train-recipe.json'), 'utf8'));

function parseArgs(argv) {
  const out = { skipPreflight: false, skipTrain: false, skipGate: false, skipGguf: false, gpu: false };
  for (const a of argv.slice(2)) {
    if (a === '--skip-preflight') out.skipPreflight = true;
    else if (a === '--skip-train') out.skipTrain = true;
    else if (a === '--skip-gate') out.skipGate = true;
    else if (a === '--skip-gguf') out.skipGguf = true;
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
if (!args.skipPreflight) {
  run('leak-check', process.execPath, [join(here, 'leak-check.mjs')]);
  run('assert-sft-v3', process.execPath, [join(here, 'assert-sft-v3.mjs')]);
}
if (!args.skipTrain) {
  const py = process.env.AIRP_TRAIN_PYTHON || 'python3';
  const trainArgs = [join(here, 'train.py')];
  if (args.skipGguf) trainArgs.push('--skip-gguf');
  run('train', py, trainArgs);
}
if (!args.skipGate) {
  const artifactsPath = join(repoRoot, trainRecipe.outputs.dir, trainRecipe.outputs.manifest);
  if (!existsSync(artifactsPath)) {
    console.error(`no artifacts at ${artifactsPath}`);
    process.exit(1);
  }
  const gateArgs = [join(here, 'gate.mjs')];
  if (args.gpu) gateArgs.push('--gpu');
  run('gate', process.execPath, gateArgs);
}
