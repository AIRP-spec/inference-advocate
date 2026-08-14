#!/usr/bin/env node
// Fail a corpus that leaks held-out content. Run before every training run.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildLeakIndex,
  leakReason,
  loadHeldOutContentsFromSuite,
  normalizeContent,
} from './leak.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const recipe = JSON.parse(readFileSync(join(here, 'recipe.json'), 'utf8'));

const corpusPath = process.argv[2] || join(repoRoot, recipe.outputs.corpus);
if (!existsSync(corpusPath)) {
  console.error(`leak-check failed: no corpus at ${corpusPath}. generate must succeed first.`);
  process.exit(1);
}
const heldOutPath = join(repoRoot, recipe.heldOutSuite);
const index = buildLeakIndex(loadHeldOutContentsFromSuite(heldOutPath));

const lines = readFileSync(corpusPath, 'utf8')
  .split('\n')
  .filter((line) => line.trim());
if (lines.length === 0) {
  console.error(`leak-check failed: corpus is empty (${corpusPath}). generate must succeed first.`);
  process.exit(1);
}

/** @type {Set<string>} */
const seen = new Set();
/** @type {string[]} */
const leaks = [];
for (const line of lines) {
  const row = JSON.parse(line);
  const reason = leakReason(row.content, index);
  if (reason) leaks.push(`${row.id}: ${reason}`);
  const key = normalizeContent(row.content);
  if (seen.has(key)) leaks.push(`${row.id}: duplicate-corpus`);
  seen.add(key);
  if (row.taxonomyVersion !== recipe.taxonomyVersion) {
    leaks.push(`${row.id}: taxonomyVersion ${row.taxonomyVersion} != recipe ${recipe.taxonomyVersion}`);
  }
  if (row.promptTemplateVersion !== recipe.promptTemplateVersion) {
    leaks.push(`${row.id}: promptTemplateVersion mismatch`);
  }
}

if (leaks.length > 0) {
  console.error(`leak-check failed (${leaks.length}):\n${leaks.slice(0, 40).join('\n')}`);
  process.exit(1);
}
console.log(`leak-check ok: ${lines.length} examples, 0 held-out collisions`);
