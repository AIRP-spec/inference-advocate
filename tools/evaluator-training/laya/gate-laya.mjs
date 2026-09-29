#!/usr/bin/env node
// Provisional Section 3.3. Gate Laya checkpoint on held-out suite.
// Loads Laya checkpoint, evaluates 17 questions per suite item, applies thresholds, composes via shared compose.
// Emits same report shape as gate.mjs.

import { readFileSync } from 'node:fs';

// NOTE: Laya loading and inference will require Python interop or a Node.js Laya wrapper.
// This is a scaffold. Actual implementation will depend on how Laya models are loaded/run from Node.
// Options:
// 1. Python subprocess with JSON I/O
// 2. ONNX export + onnxruntime-node
// 3. Native Laya.js wrapper (if available)

// For now, this is pseudocode demonstrating the flow.

async function loadLayaCheckpoint(checkpointPath) {
  // TODO: Load Laya checkpoint from path
  // Return model object with .evaluate(state, questions) method
  throw new Error('Laya checkpoint loading not implemented — scaffold only');
}

async function evaluateWithLaya(model, state, questions) {
  // TODO: Call Laya model with state and questions
  // Return {stance: {choice: "..."}, primitive: {noul: bool}, ...}
  throw new Error('Laya evaluation not implemented — scaffold only');
}

function applyThresholds(rawAnswers, thresholds) {
  const primitives = {
    stance: rawAnswers.stance.choice,
    objects: [],
    qualifiers: []
  };

  const objects = ['violence_person', 'self_harm', 'sexual_activity', 'financial_crime', 'intrusion', 'weapons', 'profanity'];
  for (const obj of objects) {
    const thresh = thresholds[obj] ?? 0.5;
    if (rawAnswers[obj].noul >= thresh) {
      primitives.objects.push(obj);
    }
  }

  const qualifiers = ['targets_protected_characteristic', 'subject_is_minor', 'asserts_interior_state', 'addresses_own_nature', 'explicit_register', 'exceeds_common_knowledge', 'is_mention_not_use', 'directed_at_user', 'untethered_to_content'];
  for (const qual of qualifiers) {
    const thresh = thresholds[qual] ?? 0.5;
    if (rawAnswers[qual].noul >= thresh) {
      primitives.qualifiers.push(qual);
    }
  }

  return primitives;
}

async function gateLayaCheckpoint(checkpointPath, suitePath, questionsPath, thresholdsPath, composePath) {
  const suite = JSON.parse(readFileSync(suitePath, 'utf8'));
  const questions = JSON.parse(readFileSync(questionsPath, 'utf8'));
  const thresholds = thresholdsPath ? JSON.parse(readFileSync(thresholdsPath, 'utf8')) : {};
  
  // Dynamic import of shared compose
  const { composeFromPrimitives } = await import(composePath);

  const model = await loadLayaCheckpoint(checkpointPath);

  const results = [];
  for (const item of suite.items) {
    const state = item.content;
    const rawAnswers = await evaluateWithLaya(model, state, questions.questions);
    const primitives = applyThresholds(rawAnswers, thresholds);
    const flags = composeFromPrimitives(primitives);
    
    results.push({
      id: item.id,
      primitives,
      flags,
      expect: item.expect
    });
  }

  // Compute gate metrics (extras, recall, per-atom P/R, CSE)
  // This follows the same logic as gate.mjs
  const gateReport = computeGateMetrics(results);
  
  return gateReport;
}

function computeGateMetrics(results) {
  // TODO: Implement gate metrics computation
  // Same as gate.mjs: extras, recall, per-atom confusion, CSE named gate
  return {
    note: 'Gate metrics computation scaffold — implement full logic from gate.mjs'
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 4) {
    console.error('Usage: gate-laya.mjs <checkpoint> <suite.json> <questions.json> <compose.mjs> [thresholds.json]');
    process.exit(1);
  }

  const [checkpointPath, suitePath, questionsPath, composePath, thresholdsPath] = args;

  try {
    const report = await gateLayaCheckpoint(checkpointPath, suitePath, questionsPath, thresholdsPath || null, composePath);
    console.log(JSON.stringify(report, null, 2));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { gateLayaCheckpoint };
