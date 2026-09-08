#!/usr/bin/env node
// Recompose selected composed positives into an existing corpus.
//
// Paper: step 8. The writer corpus is validated and must stay byte-identical.
// Default: composedSurfaceClasses (profanity, hate). Pass --classes to recompose
// only those composed classes, including child_sexual_exploitation (single and dual).
// No writer call.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expandScaffold } from './generate.mjs';
import {
  buildLeakIndex,
  leakReason,
  loadHeldOutContentsFromSuite,
  normalizeContent,
} from './leak.mjs';
import { mulberry32, shuffle } from './slots.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const USER_PREFIX = 'Assistant response under evaluation:\n';

function parseArgs(argv) {
  const recipe = loadJson(join(here, 'recipe.json'));
  const out = {
    corpus: join(repoRoot, recipe.outputs.corpus),
    sft: join(repoRoot, recipe.outputs.sft),
    classes: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--corpus') out.corpus = argv[++i];
    else if (a === '--sft') out.sft = argv[++i];
    else if (a === '--classes') {
      out.classes = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    } else if (a === '--help' || a === '-h') out.help = true;
    else throw new Error(`unknown argument ${a}`);
  }
  return { ...out, recipe };
}

function isTargetComposed(row, targets, cse) {
  if (row.family !== 'positive-composed') return false;
  if (targets.has(cse) && row.expect.includes(cse)) return true;
  return Boolean(row.class) && targets.has(row.class);
}

function poolKey(row, cse) {
  if (row.expect.includes(cse)) {
    return row.expect.length > 1 ? `${cse}:dual` : `${cse}:single`;
  }
  return row.class;
}

function pickContent(slot, pool, seen, leakIndex, maxChars) {
  for (const content of pool) {
    if (content.length > maxChars) continue;
    if (content.includes('\u2014')) continue;
    if (leakReason(content, leakIndex)) continue;
    const key = normalizeContent(content);
    if (seen.has(key)) continue;
    seen.add(key);
    return content;
  }
  throw new Error(
    `recompose exhausted unique leak-free strings for ${slot.id} (${slot.class}). Stop and report.`,
  );
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(
      'Usage: node tools/evaluator-training/recompose-surface.mjs [--classes a,b] [--corpus PATH] [--sft PATH]\n' +
        'Rewrites selected composed positives in place. Default classes are composedSurfaceClasses.\n' +
        'Leaves every other row untouched.',
    );
    return;
  }
  const recipe = args.recipe;
  const cse = recipe.composedClass;
  const targets = new Set(
    args.classes && args.classes.length > 0 ? args.classes : recipe.composedSurfaceClasses ?? [],
  );
  if (targets.size === 0) throw new Error('no classes to recompose');

  const corpusLines = readFileSync(args.corpus, 'utf8').split('\n');
  const trailing = corpusLines.length > 0 && corpusLines[corpusLines.length - 1] === '';
  const rows = corpusLines.filter((line) => line.trim());
  const parsed = rows.map((line) => JSON.parse(line));

  const heldOutPath = join(repoRoot, recipe.heldOutSuite);
  const leakIndex = buildLeakIndex(loadHeldOutContentsFromSuite(heldOutPath));
  /** @type {Set<string>} */
  const seen = new Set();
  for (const row of parsed) {
    if (isTargetComposed(row, targets, cse)) continue;
    seen.add(normalizeContent(row.content));
  }

  /** @type {Map<string, string[]>} */
  const pools = new Map();
  const rng = mulberry32(recipe.generator.seed);
  for (const type of targets) {
    if (type === cse) {
      const scaffold = loadJson(join(repoRoot, recipe.composedScaffold));
      pools.set(`${cse}:single`, shuffle(expandScaffold(scaffold.single), rng));
      pools.set(`${cse}:dual`, shuffle(expandScaffold(scaffold.dual), rng));
      continue;
    }
    const rel = recipe.composedScaffolds?.[type];
    if (!rel) throw new Error(`no composedScaffolds path for ${type}`);
    const scaffold = loadJson(join(repoRoot, rel));
    pools.set(type, shuffle(expandScaffold(scaffold.single), rng));
  }

  /** @type {Map<string, string>} */
  const replacement = new Map();
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const row of parsed) {
    if (!isTargetComposed(row, targets, cse)) continue;
    const key = poolKey(row, cse);
    const pool = pools.get(key);
    if (!pool) throw new Error(`no pool for ${key} (${row.id})`);
    const content = pickContent(row, pool, seen, leakIndex, recipe.generator.maxChars);
    replacement.set(row.id, content);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (replacement.size === 0) throw new Error('no matching composed rows found in corpus');

  const newCorpus = [];
  let corpusChanged = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = parsed[i];
    if (!replacement.has(row.id)) {
      newCorpus.push(rows[i]);
      continue;
    }
    const next = { ...row, content: replacement.get(row.id) };
    newCorpus.push(JSON.stringify(next));
    corpusChanged += 1;
  }

  const sftLines = readFileSync(args.sft, 'utf8').split('\n');
  const sftRows = sftLines.filter((line) => line.trim());
  const newSft = [];
  let sftChanged = 0;
  for (const line of sftRows) {
    const rec = JSON.parse(line);
    if (!replacement.has(rec.id)) {
      newSft.push(line);
      continue;
    }
    const user = rec.messages?.find((m) => m.role === 'user');
    if (!user || typeof user.content !== 'string' || !user.content.startsWith(USER_PREFIX)) {
      throw new Error(`sft ${rec.id} user turn is not the v3 evaluation wrapper`);
    }
    user.content = USER_PREFIX + replacement.get(rec.id);
    newSft.push(JSON.stringify(rec));
    sftChanged += 1;
  }
  if (sftChanged !== corpusChanged) {
    throw new Error(`sft replacements ${sftChanged} != corpus replacements ${corpusChanged}`);
  }

  writeFileSync(args.corpus, newCorpus.join('\n') + (trailing ? '\n' : ''));
  const sftTrailing = sftLines.length > 0 && sftLines[sftLines.length - 1] === '';
  writeFileSync(args.sft, newSft.join('\n') + (sftTrailing ? '\n' : ''));

  const breakdown = [...counts.entries()]
    .sort()
    .map(([k, n]) => `${k}:${n}`)
    .join(', ');
  console.log(`recomposed ${corpusChanged} composed positives in place [${breakdown}]`);
  console.log(`sft updated ${sftChanged}; other rows left byte-identical`);
}

const isDirectRun =
  Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main();
}
