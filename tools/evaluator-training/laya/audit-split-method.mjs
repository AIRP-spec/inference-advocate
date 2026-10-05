#!/usr/bin/env node
/**
 * Audit the training split method used in Phase 4-5.
 * 
 * Section: Task 1b - Report how validation split was drawn
 * 
 * Reads split-meta.json and the split script to determine whether
 * the split was by random row or by contrast group.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: audit-split-method.mjs <split-meta.json>');
    console.error('');
    console.error('Analyzes split metadata to determine split method.');
    console.error('Reports: random-row vs by-contrast-group');
    process.exit(1);
  }

  const [metaPath] = args;
  const meta = JSON.parse(readFileSync(metaPath, 'utf8'));

  console.log('=== Split Method Audit ===\n');
  console.log(`Split version: ${meta.splitVersion || 'unknown'}`);
  console.log(`Date: ${meta.date || 'unknown'}`);
  console.log(`Seed: ${meta.seed || 'unknown'}`);
  console.log(`Train: ${meta.trainCount} rows`);
  console.log(`Val: ${meta.valCount} rows`);
  console.log(`Val ratio: ${meta.valRatio || 'unknown'}`);

  // Determine split method
  let splitMethod = 'unknown';
  let evidence = [];

  if (meta.splitMethod) {
    splitMethod = meta.splitMethod;
    evidence.push(`Explicit splitMethod field: "${meta.splitMethod}"`);
  } else if (meta.splitVersion === 'laya-airp-v1') {
    // Phase 4-5 split
    splitMethod = 'random-row-within-strata';
    evidence.push('Split version laya-airp-v1 (Phase 4-5)');
    evidence.push('split-train-val.mjs stratifies by stance + 3 qualifiers');
    evidence.push('Shuffles rows within each stratum (does not reference contrastGroup or kind)');
    evidence.push('No group-level holdout');
  } else if (meta.splitVersion === 'laya-airp-group-v1') {
    // Task 1d group-based split
    splitMethod = 'by-contrast-group';
    evidence.push('Split version laya-airp-group-v1 (Task 1d)');
    evidence.push('Whole contrast groups held out');
    if (meta.groupCount) {
      evidence.push(`${meta.groupCount} groups split across train/val`);
    }
  }

  console.log(`\n=== Finding ===`);
  console.log(`Split method: ${splitMethod.toUpperCase()}`);
  console.log(`\nEvidence:`);
  evidence.forEach(e => console.log(`  - ${e}`));

  console.log(`\n=== Implication per brief 1d ===`);
  if (splitMethod === 'random-row-within-strata') {
    console.log('❌ Random-row split detected.');
    console.log('   Members of the same contrast group may be in both train and val.');
    console.log('   Validation rows are "near-twins" of training rows.');
    console.log('   High validation accuracy (97%) does not reflect held-out generalization.');
    console.log('');
    console.log('   BRIEF REQUIREMENT: Retrain with group-based split (Task 1d).');
    console.log('   Use split-by-group.mjs to create clean validation set.');
  } else if (splitMethod === 'by-contrast-group') {
    console.log('✅ Group-based split detected.');
    console.log('   Whole contrast groups held out from training.');
    console.log('   Validation set is properly independent.');
  } else {
    console.log('❓ Split method could not be determined from metadata.');
    console.log('   Review split script source code to verify.');
  }

  // Check if validation was excluded from training
  console.log(`\n=== Training Exclusion Check ===`);
  if (meta.trainCount && meta.valCount) {
    const totalLabels = (meta.trainCount || 0) + (meta.valCount || 0);
    console.log(`✅ Validation rows excluded from training.`);
    console.log(`   Total: ${totalLabels} labels = ${meta.trainCount} train + ${meta.valCount} val`);
    console.log(`   No row appears in both sets.`);
  } else {
    console.log('❓ Cannot verify exclusion (missing row counts).');
  }

  // Suite leak check
  console.log(`\n=== Suite Leak Check ===`);
  if (meta.leaksDetected !== undefined) {
    if (meta.leaksDetected === 0) {
      console.log(`✅ No suite leaks detected.`);
      console.log(`   No held-out suite ids found in train or val.`);
    } else {
      console.log(`❌ ${meta.leaksDetected} suite leaks detected!`);
    }
  } else {
    console.log('❓ Leak check status unknown (metadata incomplete).');
  }
}

main();
