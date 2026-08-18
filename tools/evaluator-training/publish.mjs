#!/usr/bin/env node
// Publish a gated GGUF under AIRP-spec. Refuses a failing or missing gate.
//
// Paper: step 8. The judge's formation (data, recipe, weights) is inspectable.
// This does not flip the live pin or the default evaluator. Pass --execute to
// upload; without it, print the commands.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const trainRecipe = JSON.parse(readFileSync(join(here, 'train-recipe.json'), 'utf8'));
const genRecipe = JSON.parse(readFileSync(join(here, 'recipe.json'), 'utf8'));

function parseArgs(argv) {
  const out = { execute: false, pinManifest: false };
  for (const a of argv.slice(2)) {
    if (a === '--execute') out.execute = true;
    else if (a === '--pin-manifest') out.pinManifest = true;
    else throw new Error(`unknown argument ${a}`);
  }
  return out;
}

const args = parseArgs(process.argv);
const outDir = join(repoRoot, trainRecipe.outputs.dir);
const reportPath = join(outDir, trainRecipe.outputs.gateReport);
const artifactsPath = join(outDir, trainRecipe.outputs.manifest);
if (!existsSync(reportPath) || !existsSync(artifactsPath)) {
  console.error('publish requires artifacts.json and gate-report.json from a completed run.');
  process.exit(1);
}
const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const artifacts = JSON.parse(readFileSync(artifactsPath, 'utf8'));
if (!report.pass) {
  console.error('gate-report.json pass is not true. Do not publish.');
  process.exit(2);
}

const org = trainRecipe.publish.hubOrg;
const name = trainRecipe.publish.repoName;
const repoId = `${org}/${name}`;
const files = [
  artifacts.ggufPath,
  join(here, 'recipe.json'),
  join(here, 'train-recipe.json'),
  join(here, 'prompts.json'),
  join(here, 'cse-scaffold.json'),
  join(here, 'violence-conjunction-scaffold.json'),
  join(here, 'profanity-scaffold.json'),
  join(here, 'hate-scaffold.json'),
  join(repoRoot, genRecipe.heldOutSuite),
  join(repoRoot, 'data/evaluator-gate/gate.json'),
  reportPath,
  artifactsPath,
];
for (const f of files) {
  if (!existsSync(f)) {
    console.error(`missing publish input ${f}`);
    process.exit(1);
  }
}

const provenance = [
  'AIRP reference evaluator (trained candidate)',
  '',
  `Paper: ${trainRecipe.paper}`,
  `Pin: ${report.pin}`,
  `Base: ${artifacts.baseRepoId}`,
  `Template: ${artifacts.promptTemplateVersion}`,
  `Seed: ${artifacts.seed}`,
  `SFT rows: ${artifacts.n}`,
  `Quantization: ${artifacts.quantization}`,
  `License: ${trainRecipe.publish.license}`,
  '',
  'Formation, not only bytes: generation recipe, scaffolds, training recipe,',
  'held-out gate config, and gate-report.json ship beside the GGUF.',
  'The live advocate pin remains the vendor Qwen3-0.6B Q8_0 at template v2.1',
  'until a separate integration step promotes this candidate.',
  '',
].join('\n');
const cardPath = join(outDir, 'MODEL-CARD.md');
writeFileSync(cardPath, provenance);

console.log(`publish target ${repoId}`);
console.log(`license ${trainRecipe.publish.license}`);
console.log('files:');
for (const f of [...files, cardPath]) console.log(`  ${f}`);

const hfArgs = [
  ['hf', 'repo', 'create', repoId, '--type', 'model', '--exist-ok'],
  ['hf', 'upload', repoId, artifacts.ggufPath, trainRecipe.gguf.fileName],
  ['hf', 'upload', repoId, cardPath, 'README.md'],
  ['hf', 'upload', repoId, join(here, 'recipe.json'), 'formation/recipe.json'],
  ['hf', 'upload', repoId, join(here, 'train-recipe.json'), 'formation/train-recipe.json'],
  ['hf', 'upload', repoId, join(here, 'prompts.json'), 'formation/prompts.json'],
  ['hf', 'upload', repoId, join(here, 'cse-scaffold.json'), 'formation/cse-scaffold.json'],
  ['hf', 'upload', repoId, join(here, 'profanity-scaffold.json'), 'formation/profanity-scaffold.json'],
  ['hf', 'upload', repoId, join(here, 'hate-scaffold.json'), 'formation/hate-scaffold.json'],
  ['hf', 'upload', repoId, join(here, 'persona-claims-scaffold.json'), 'formation/persona-claims-scaffold.json'],
  ['hf', 'upload', repoId, join(here, 'relational-hooks-scaffold.json'), 'formation/relational-hooks-scaffold.json'],
  ['hf', 'upload', repoId, join(here, 'sycophancy-scaffold.json'), 'formation/sycophancy-scaffold.json'],
  ['hf', 'upload', repoId, join(here, 'simulation-obscured-scaffold.json'), 'formation/simulation-obscured-scaffold.json'],
  ['hf', 'upload', repoId, join(here, 'self-harm-scaffold.json'), 'formation/self-harm-scaffold.json'],
  ['hf', 'upload', repoId, join(here, 'sexual-content-scaffold.json'), 'formation/sexual-content-scaffold.json'],
  ['hf', 'upload', repoId, join(here, 'violence-conjunction-scaffold.json'), 'formation/violence-conjunction-scaffold.json'],
  ['hf', 'upload', repoId, join(repoRoot, genRecipe.outputs.sft), 'formation/sft.jsonl'],
  ['hf', 'upload', repoId, join(repoRoot, genRecipe.heldOutSuite), 'formation/held-out-suite.v1.json'],
  ['hf', 'upload', repoId, join(repoRoot, 'data/evaluator-gate/gate.json'), 'formation/gate.json'],
  ['hf', 'upload', repoId, reportPath, 'formation/gate-report.json'],
  ['hf', 'upload', repoId, artifactsPath, 'formation/artifacts.json'],
];

if (!args.execute) {
  console.log('\nDry run. Commands (need hf auth with write to the org):');
  for (const cmd of hfArgs) console.log(cmd.join(' '));
  console.log('\nRe-run with --execute after a green gate. Add --pin-manifest to record trainedCandidate without flipping the live pin.');
  process.exit(0);
}

for (const cmd of hfArgs) {
  console.log('+', cmd.join(' '));
  const result = spawnSync(cmd[0], cmd.slice(1), { cwd: repoRoot, stdio: 'inherit', env: process.env });
  if (result.status !== 0) {
    console.error(`publish failed on ${cmd.join(' ')}`);
    process.exit(result.status ?? 1);
  }
}

if (args.pinManifest) {
  const manifestPath = join(repoRoot, 'data/models/manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.trainedCandidate = {
    status: 'gated, not live',
    fileName: trainRecipe.gguf.fileName,
    sourceUrl: `https://huggingface.co/${repoId}/resolve/main/${trainRecipe.gguf.fileName}`,
    sha256: report.digest,
    promptTemplateVersion: 'v3',
    pin: report.pin,
    provenance: `formation under ${repoId}: corpus recipe, train-recipe, scaffolds, gate-report. Live pin remains the vendor GGUF at template v2.1.`,
  };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`recorded trainedCandidate on ${manifestPath} (live pin unchanged)`);
}
console.log('publish complete. Default evaluator is still the rule evaluator until a separate integration step.');
