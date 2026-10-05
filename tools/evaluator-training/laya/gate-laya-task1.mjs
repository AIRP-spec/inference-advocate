#!/usr/bin/env node
/**
 * Gate Laya checkpoints with shared gold proxies and dual threshold conditions.
 * 
 * Section: Task 1a, 1c, 1f
 * Prerequisites: PRE-DECLARATIONS.md committed before running
 * 
 * Measures:
 * - Per-primitive precision/recall against gold proxies
 * - Composed extras/recalls via @airp/evaluator-local compose
 * - Default vs validation-fitted threshold comparison
 * - Latency (median, p95) per item
 * - Expected Calibration Error per primitive
 * - Count of items >1024 tokens (ModernBERT tokenizer)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Placeholder: actual Laya loading would use laya package
// For now, document expected interface

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.error('Usage: gate-laya-task1.mjs <checkpoint-dir> <suite-path> <gold-proxies-path> [--report <output.json>]');
    console.error('');
    console.error('Inputs:');
    console.error('  checkpoint-dir: Directory containing Laya checkpoint (e.g. ckpt-epoch-2.6-step-10160/)');
    console.error('  suite-path: Path to held-out-suite.v2.json');
    console.error('  gold-proxies-path: Path to gold-proxies.v0.5.0.json');
    console.error('');
    console.error('Expected checkpoint structure:');
    console.error('  checkpoint-dir/');
    console.error('    model.safetensors');
    console.error('    config.json');
    console.error('    thresholds.json (validation-fitted thresholds)');
    process.exit(1);
  }

  const [checkpointDir, suitePath, goldProxiesPath] = args;
  const reportPath = args.includes('--report') ? args[args.indexOf('--report') + 1] : 'gate-report.json';

  console.log(`Loading checkpoint: ${checkpointDir}`);
  console.log(`Suite: ${suitePath}`);
  console.log(`Gold proxies: ${goldProxiesPath}`);

  // Load inputs
  const suite = JSON.parse(readFileSync(suitePath, 'utf8'));
  const goldProxies = JSON.parse(readFileSync(goldProxiesPath, 'utf8'));
  const thresholdsPath = join(checkpointDir, 'thresholds.json');
  const fittedThresholds = JSON.parse(readFileSync(thresholdsPath, 'utf8'));

  // TODO: Load Laya model
  // const model = await loadLayaCheckpoint(checkpointDir);
  // const tokenizer = await loadModernBERTTokenizer();

  console.log('Running inference on 471 suite items...');
  
  const results = {
    checkpoint: checkpointDir,
    suiteItems: suite.items.length,
    goldProxiesSha256: sha256File(goldProxiesPath),
    suiteSha256: sha256File(suitePath),
    defaultThresholds: buildDefaultThresholds(),
    fittedThresholds: fittedThresholds,
    perItem: [],
    latency: { medianMs: null, p95Ms: null },
    tokenCounts: { over1024: 0, max: 0 },
    calibrationError: {},
  };

  const latencies = [];

  for (const item of suite.items) {
    const startMs = Date.now();
    
    // TODO: Run Laya inference
    // const primitives = await model.evaluate(item.content, questions);
    // For now, placeholder
    const primitives = { stance: 'describes', objects: [], qualifiers: [] };
    
    const elapsedMs = Date.now() - startMs;
    latencies.push(elapsedMs);

    // Tokenize to count tokens
    // const tokenCount = tokenizer.encode(item.content).length;
    const tokenCount = 0; // placeholder
    if (tokenCount > 1024) results.tokenCounts.over1024++;
    if (tokenCount > results.tokenCounts.max) results.tokenCounts.max = tokenCount;

    // Score against gold proxies with both threshold sets
    const defaultScored = scorePrimitives(primitives, goldProxies, results.defaultThresholds);
    const fittedScored = scorePrimitives(primitives, goldProxies, results.fittedThresholds);

    // Compose to flags
    // const defaultComposed = await compose(defaultScored.binary);
    // const fittedComposed = await compose(fittedScored.binary);
    const defaultComposed = []; // placeholder
    const fittedComposed = []; // placeholder

    results.perItem.push({
      id: item.id,
      expect: item.expect,
      primitives,
      defaultScored,
      fittedScored,
      defaultComposed,
      fittedComposed,
      latencyMs: elapsedMs,
      tokenCount,
    });
  }

  // Latency statistics
  latencies.sort((a, b) => a - b);
  results.latency.medianMs = latencies[Math.floor(latencies.length / 2)];
  results.latency.p95Ms = latencies[Math.floor(latencies.length * 0.95)];

  // Compute per-primitive precision/recall
  results.primitiveMetrics = computePrimitiveMetrics(results.perItem, goldProxies, 'default');
  results.primitiveMetricsFitted = computePrimitiveMetrics(results.perItem, goldProxies, 'fitted');

  // Compute ECE per primitive
  results.calibrationError = computeECE(results.perItem, goldProxies);

  // Compose-level extras/recalls
  results.defaultGate = computeGateMetrics(results.perItem, 'default');
  results.fittedGate = computeGateMetrics(results.perItem, 'fitted');

  // Write report
  writeFileSync(reportPath, JSON.stringify(results, null, 2) + '\n');
  console.log(`\nWrote report: ${reportPath}`);
  console.log(`Latency: median ${results.latency.medianMs}ms, p95 ${results.latency.p95Ms}ms`);
  console.log(`>1024 tokens: ${results.tokenCounts.over1024}/${suite.items.length}`);
  console.log(`Default gate: ${results.defaultGate.extras} extras, ${results.defaultGate.recalls} recalls`);
  console.log(`Fitted gate: ${results.fittedGate.extras} extras, ${results.fittedGate.recalls} recalls`);
}

function buildDefaultThresholds() {
  return {
    objects: 0.5,
    qualifiers: 0.5,
    stance: 'argmax',
  };
}

function scorePrimitives(primitives, goldProxies, thresholds) {
  // Apply thresholds to get binary yes/no per primitive
  // Return { binary: { objects: [], qualifiers: [] }, probabilities: {...} }
  return { binary: { objects: [], qualifiers: [] }, probabilities: {} };
}

function computePrimitiveMetrics(perItem, goldProxies, thresholdType) {
  // For each primitive, compute TP/FP/FN/TN against gold proxy
  const metrics = {};
  // TODO: iterate primitives, check expect against goldProxies expectIncludes
  return metrics;
}

function computeECE(perItem, goldProxies) {
  // Expected Calibration Error per primitive
  // Bin probabilities, compute |accuracy - confidence| per bin
  return {};
}

function computeGateMetrics(perItem, thresholdType) {
  // Count extras and recall misses at composed level
  let extras = 0;
  let recalls = 0;
  for (const item of perItem) {
    const composed = thresholdType === 'default' ? item.defaultComposed : item.fittedComposed;
    const extraFlags = composed.filter(f => !item.expect.includes(f));
    const missedFlags = item.expect.filter(f => !composed.includes(f));
    extras += extraFlags.length;
    recalls += missedFlags.length;
  }
  return { extras, recalls };
}

function sha256File(path) {
  const { createHash } = await import('node:crypto');
  const content = readFileSync(path);
  return createHash('sha256').update(content).digest('hex');
}

main();
