#!/usr/bin/env node
/**
 * Split train/val by contrast group (whole groups held out).
 * 
 * Section: Task 1d - Group-based validation split for retrain
 * 
 * Fixes the random-row split issue: ensures no members of the same
 * contrast group appear in both train and val sets.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const SPLIT_SEED = 202610050001n; // New seed for Task 1d retrain
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

function groupByContrastGroup(rows) {
  const groups = new Map();
  for (const row of rows) {
    // Use contrastGroup if present, otherwise use kind as fallback
    const groupKey = row.contrastGroup || row.kind || row.id;
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push(row);
  }
  return groups;
}

function splitByGroups(groups, valRatio, seed) {
  const groupKeys = Array.from(groups.keys());
  const shuffled = seededShuffle(groupKeys, seed);
  
  const valCount = Math.max(1, Math.floor(groupKeys.length * valRatio));
  const valKeys = new Set(shuffled.slice(0, valCount));
  
  const train = [];
  const val = [];
  
  for (const [key, rows] of groups) {
    if (valKeys.has(key)) {
      val.push(...rows);
    } else {
      train.push(...rows);
    }
  }
  
  return { train, val };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 3) {
    console.error('Usage: split-by-group.mjs <labels.jsonl> <suite.json> <outdir>');
    console.error('');
    console.error('Splits labels into train/val by contrast group (whole groups held out).');
    console.error('Groups are determined by contrastGroup field (or kind as fallback).');
    console.error('');
    console.error('Outputs:');
    console.error('  <outdir>/train.jsonl');
    console.error('  <outdir>/val.jsonl');
    console.error('  <outdir>/split-meta-group.json');
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

  // Group by contrastGroup/kind
  const groups = groupByContrastGroup(rows);
  console.log(`Grouped ${rows.length} rows into ${groups.size} contrast groups`);
  
  // Split by groups
  const { train, val } = splitByGroups(groups, VAL_RATIO, SPLIT_SEED);

  // Write outputs
  const trainJsonl = train.map(r => JSON.stringify(r)).join('\n') + '\n';
  const valJsonl = val.map(r => JSON.stringify(r)).join('\n') + '\n';
  writeFileSync(`${outdir}/train.jsonl`, trainJsonl);
  writeFileSync(`${outdir}/val.jsonl`, valJsonl);

  const trainSha = sha256(trainJsonl);
  const valSha = sha256(valJsonl);

  const meta = {
    splitVersion: 'laya-airp-group-v1',
    date: new Date().toISOString().split('T')[0],
    seed: SPLIT_SEED.toString(),
    valRatio: VAL_RATIO,
    splitMethod: 'by_contrast_group',
    labelsPath,
    labelsSha256: sha256(labelsText),
    suitePath,
    suiteIds: suite.items.length,
    leaksDetected: 0,
    groupCount: groups.size,
    trainCount: train.length,
    valCount: val.length,
    trainSha256: trainSha,
    valSha256: valSha,
  };

  writeFileSync(`${outdir}/split-meta-group.json`, JSON.stringify(meta, null, 2) + '\n');

  console.log(`Split complete: ${train.length} train, ${val.length} val (${groups.size} groups)`);
  console.log(`  train SHA: ${trainSha.slice(0, 12)}`);
  console.log(`  val SHA:   ${valSha.slice(0, 12)}`);
  console.log(`  No suite leaks detected.`);
  console.log(`  Metadata: ${outdir}/split-meta-group.json`);
}

main();
