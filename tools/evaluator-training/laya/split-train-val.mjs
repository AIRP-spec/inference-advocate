#!/usr/bin/env node
// Provisional Section 3.3. Train/val split for Laya primitives fine-tune.
// Deterministic stratified split: ~90% train, ~10% val.
// Stratifies by stance and key rare positives (subject_is_minor, exceeds_common_knowledge, is_mention_not_use).
// Asserts no held-out suite ids in train or val.

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const SPLIT_SEED = 202609290001n;
const VAL_RATIO = 0.1;

function sha256(data) {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

function seededShuffle(arr, seed) {
  const rng = mulberry32(Number(seed & 0xffffffffn));
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function stratify(rows) {
  const strata = new Map();
  for (const row of rows) {
    const key = [
      row.stance,
      row.qualifiers.includes('subject_is_minor') ? 'minor' : 'no_minor',
      row.qualifiers.includes('exceeds_common_knowledge') ? 'eck' : 'no_eck',
      row.qualifiers.includes('is_mention_not_use') ? 'mention' : 'no_mention'
    ].join('_');
    if (!strata.has(key)) strata.set(key, []);
    strata.get(key).push(row);
  }
  return strata;
}

function splitStratified(strata, valRatio, seed) {
  const train = [];
  const val = [];
  for (const [key, rows] of strata) {
    const shuffled = seededShuffle(rows, seed ^ BigInt(key.split('').reduce((a, c) => a + c.charCodeAt(0), 0)));
    const valCount = Math.max(1, Math.floor(rows.length * valRatio));
    val.push(...shuffled.slice(0, valCount));
    train.push(...shuffled.slice(valCount));
  }
  return { train, val };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 3) {
    console.error('Usage: split-train-val.mjs <labels.jsonl> <suite.json> <outdir>');
    console.error('  Reads labels, checks for suite leaks, writes train.jsonl + val.jsonl + split-meta.json');
    process.exit(1);
  }

  const [labelsPath, suitePath, outdir] = args;

  const labelsText = readFileSync(labelsPath, 'utf8');
  const labelsLines = labelsText.trim().split('\n').filter(l => l);
  const rows = labelsLines.map(l => JSON.parse(l));

  const suiteText = readFileSync(suitePath, 'utf8');
  const suite = JSON.parse(suiteText);
  const suiteIds = new Set(suite.items.map(item => item.id));

  // Check for leaks
  const leaks = rows.filter(r => suiteIds.has(r.id));
  if (leaks.length > 0) {
    console.error(`ERROR: ${leaks.length} suite ids found in labels (leak detected):`);
    leaks.forEach(r => console.error(`  ${r.id}`));
    process.exit(1);
  }

  // Stratify and split
  const strata = stratify(rows);
  const { train, val } = splitStratified(strata, VAL_RATIO, SPLIT_SEED);

  // Write outputs
  const trainJsonl = train.map(r => JSON.stringify(r)).join('\n') + '\n';
  const valJsonl = val.map(r => JSON.stringify(r)).join('\n') + '\n';
  writeFileSync(`${outdir}/train.jsonl`, trainJsonl);
  writeFileSync(`${outdir}/val.jsonl`, valJsonl);

  const trainSha = sha256(trainJsonl);
  const valSha = sha256(valJsonl);

  const meta = {
    splitVersion: 'laya-airp-v1',
    date: new Date().toISOString().split('T')[0],
    seed: SPLIT_SEED.toString(),
    valRatio: VAL_RATIO,
    labelsPath,
    labelsSha256: sha256(labelsText),
    suitePath,
    suiteIds: suite.items.length,
    leaksDetected: 0,
    trainCount: train.length,
    valCount: val.length,
    trainSha256: trainSha,
    valSha256: valSha,
    strataKeys: Array.from(strata.keys()).sort()
  };

  writeFileSync(`${outdir}/split-meta.json`, JSON.stringify(meta, null, 2) + '\n');

  console.log(`Split complete: ${train.length} train, ${val.length} val`);
  console.log(`  train SHA: ${trainSha.slice(0, 12)}`);
  console.log(`  val SHA:   ${valSha.slice(0, 12)}`);
  console.log(`  No suite leaks detected.`);
  console.log(`  Metadata: ${outdir}/split-meta.json`);
}

main();
