#!/usr/bin/env node
// Stratified review sample from a generated corpus.
//
// Paper: step 8. Bounded review, not full-corpus review. A few hundred items,
// mixed families, before any training run.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mulberry32, shuffle } from './slots.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');

function loadJsonl(path) {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

function parseArgs(argv) {
  const recipe = JSON.parse(readFileSync(join(here, 'recipe.json'), 'utf8'));
  const out = {
    corpus: join(repoRoot, recipe.outputs.corpus),
    dest: join(repoRoot, recipe.outputs.reviewSample),
    size: recipe.reviewSampleSize,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--corpus') out.corpus = argv[++i];
    else if (a === '--out') out.dest = argv[++i];
    else if (a === '--size') out.size = Number(argv[++i]);
    else throw new Error(`unknown argument ${a}`);
  }
  return out;
}

function groupKey(row) {
  if (row.family === 'positive-single') {
    return row.kind ? `${row.family}:${row.class}:${row.kind}` : `${row.family}:${row.class}`;
  }
  if (row.family === 'mention-versus-use' || row.family === 'class-refusal') {
    return `${row.family}:${row.class}`;
  }
  if (row.family === 'sensitive-discussion') return `${row.family}:${row.class}`;
  if (row.family === 'positive-multi') {
    return `${row.family}:${(row.expect ?? []).join('+')}`;
  }
  if (row.family === 'positive-composed') {
    if (row.kind) return `${row.family}:${row.class}:${row.kind}`;
    return `${row.family}:${(row.expect ?? []).join('+')}`;
  }
  return row.family;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const recipe = JSON.parse(readFileSync(join(here, 'recipe.json'), 'utf8'));
  const rows = loadJsonl(args.corpus);
  if (rows.length === 0) throw new Error(`empty corpus ${args.corpus}`);

  /** @type {Map<string, typeof rows>} */
  const groups = new Map();
  for (const row of rows) {
    const key = groupKey(row);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const rng = mulberry32(recipe.generator.seed + 17);
  const keys = [...groups.keys()].sort();
  /** @type {typeof rows} */
  const picked = [];
  const used = new Set();

  // At least one from every stratum, then round-robin until size.
  for (const key of keys) {
    const list = shuffle(groups.get(key), rng);
    const row = list[0];
    picked.push(row);
    used.add(row.id);
  }
  let guard = 0;
  while (picked.length < args.size && guard < rows.length * 2) {
    guard += 1;
    let added = false;
    for (const key of keys) {
      if (picked.length >= args.size) break;
      const next = shuffle(groups.get(key), rng).find((r) => !used.has(r.id));
      if (!next) continue;
      picked.push(next);
      used.add(next.id);
      added = true;
    }
    if (!added) break;
  }

  const sample = {
    paper: 'step 8. Provisional Section 3.3.',
    taxonomyVersion: recipe.taxonomyVersion,
    promptTemplateVersion: recipe.promptTemplateVersion,
    corpus: args.corpus,
    corpusSize: rows.length,
    sampleSize: picked.length,
    seed: recipe.generator.seed + 17,
    review: {
      status: 'pending',
      reviewer: 'Justin Philip Flores',
      note: 'Bounded stratified sample. Not full-corpus review. Accept before any training run. New register kinds and composed slices must appear in the strata.',
    },
    items: picked,
  };
  writeFileSync(args.dest, JSON.stringify(sample, null, 2) + '\n');
  console.log(`review sample ${picked.length} from ${rows.length} -> ${args.dest}`);
  console.log(`strata ${keys.length}`);
}

main();
