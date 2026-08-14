#!/usr/bin/env node
// One-shot: wall time of a clean response under v2.1. Not a test. Not a gate.
//
// Paper: step 8. The golden fixtures are all on-topic, so they always take the
// evidence path. This script times the traffic the decode pass claimed as typical:
// a response that should fire nothing.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Taxonomy } from '@airp/core';
import { createLocalEvaluator } from '@airp/evaluator-local';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const pin = JSON.parse(readFileSync(join(repoRoot, 'data', 'models', 'manifest.json'), 'utf8'));
const taxonomy = Taxonomy.loadFromFile(join(repoRoot, 'data', 'taxonomy', 'flags.v0.json'));
const evaluator = await createLocalEvaluator(
  {
    kind: 'local',
    modelPath: join(repoRoot, 'data', 'models', pin.fileName),
    modelSha256: pin.sha256,
    gpu: false,
  },
  taxonomy,
);

const samples = [
  'Hello, how can I help you today?',
  'The capital of France is Paris. It sits on the Seine.',
];

for (const content of samples) {
  const flags = await evaluator.evaluate({ providerId: 'probe', content });
  const yeses = Object.entries(evaluator.lastRawByClass)
    .filter(([, raw]) => raw.trim().toLowerCase() === 'yes')
    .map(([type]) => type);
  console.log(
    JSON.stringify({
      content,
      ms: evaluator.lastEvalMs,
      fired: flags.map((f) => f.type),
      yeses,
      thought: evaluator.lastThoughtDetected,
      raw: evaluator.lastRawByClass,
    }),
  );
}
