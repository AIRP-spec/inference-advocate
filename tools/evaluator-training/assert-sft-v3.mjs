#!/usr/bin/env node
// Assert that SFT chat turns equal prompt-v3 rendering for sampled rows.
//
// Paper: step 8. Train and inference share one serialization. If this check
// fails, the LoRA would learn a different prompt than LocalEvaluator v3 sends.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const genRecipe = JSON.parse(readFileSync(join(here, 'recipe.json'), 'utf8'));
const trainRecipe = JSON.parse(readFileSync(join(here, 'train-recipe.json'), 'utf8'));

let Taxonomy;
let buildV3ChatTurns;
let serializeCompactVerdict;
let taxonomyTypes;
let PROMPT_TEMPLATE_V3;
try {
  ({ Taxonomy } = await import('@airp/core'));
  ({ buildV3ChatTurns, serializeCompactVerdict, taxonomyTypes, PROMPT_TEMPLATE_V3 } = await import(
    '@airp/evaluator-local'
  ));
} catch (err) {
  console.error(`cannot import built packages (${err.message}). Run npm run build first.`);
  process.exit(1);
}

if (PROMPT_TEMPLATE_V3 !== trainRecipe.promptTemplateVersion) {
  console.error(
    `PROMPT_TEMPLATE_V3 is ${PROMPT_TEMPLATE_V3}, train-recipe wants ${trainRecipe.promptTemplateVersion}`,
  );
  process.exit(1);
}

const taxPath = join(repoRoot, genRecipe.taxonomyFile);
const taxonomy = Taxonomy.loadFromFile(taxPath);
const types = taxonomyTypes(taxonomy);
const sftPath = join(repoRoot, trainRecipe.sft);
const corpusPath = join(repoRoot, genRecipe.outputs.corpus);
if (!existsSync(sftPath) || !existsSync(corpusPath)) {
  console.error(`SFT or corpus missing. Need ${sftPath} and ${corpusPath}.`);
  process.exit(1);
}

function loadJsonl(path) {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

const sftRows = loadJsonl(sftPath);
const corpusRows = loadJsonl(corpusPath);
if (sftRows.length !== corpusRows.length) {
  console.error(`SFT has ${sftRows.length} rows, corpus has ${corpusRows.length}`);
  process.exit(1);
}
if (sftRows.length !== 3936) {
  console.error(`SFT has ${sftRows.length} rows, recipe total is 3936`);
  process.exit(1);
}

const sftById = new Map(sftRows.map((row) => [row.id, row]));
const mismatches = [];
const sampleIds = new Set();
sampleIds.add(corpusRows[0].id);
sampleIds.add(corpusRows[corpusRows.length - 1].id);
for (const row of corpusRows) {
  if (row.expect?.length > 0) {
    sampleIds.add(row.id);
    break;
  }
}
for (const row of corpusRows) {
  if (row.expect?.length > 1) {
    sampleIds.add(row.id);
    break;
  }
}

function checkRow(corpus) {
  const sft = sftById.get(corpus.id);
  if (!sft) return `${corpus.id}: missing SFT row`;
  const turns = buildV3ChatTurns(taxonomy, { providerId: 'train', content: corpus.content });
  const verdict = serializeCompactVerdict(types, corpus.expect);
  const msgs = sft.messages;
  if (!msgs || msgs.length !== 3) return `${corpus.id}: not three messages`;
  if (msgs[0].role !== 'system' || msgs[0].content !== turns.system) {
    return `${corpus.id}: system turn != buildV3ChatTurns`;
  }
  if (msgs[1].role !== 'user' || msgs[1].content !== turns.user) {
    return `${corpus.id}: user turn != buildV3ChatTurns`;
  }
  if (msgs[2].role !== 'assistant' || msgs[2].content !== verdict) {
    return `${corpus.id}: assistant != serializeCompactVerdict`;
  }
  return null;
}

for (const id of sampleIds) {
  const corpus = corpusRows.find((r) => r.id === id);
  const err = checkRow(corpus);
  if (err) mismatches.push(err);
}

let scanned = 0;
for (const corpus of corpusRows) {
  if (sampleIds.has(corpus.id)) continue;
  if (scanned >= 24) break;
  const err = checkRow(corpus);
  if (err) mismatches.push(err);
  scanned += 1;
}

if (mismatches.length > 0) {
  console.error(`sft-v3 mismatch (${mismatches.length}):\n${mismatches.join('\n')}`);
  process.exit(1);
}
console.log(
  `sft-v3 ok: ${sftRows.length} rows, prompt-v3 ${PROMPT_TEMPLATE_V3}, sampled ${sampleIds.size} ids plus ${scanned} sequential`,
);
