#!/usr/bin/env node
// Stratified review sample from a generated corpus.
//
// Paper: step 8. Bounded review, not full-corpus review. A few hundred items,
// mixed families, before any training run. --keep plus --add-kinds resamples
// only named kinds into an existing sample so reviewed items stay put.
// Floors prefer writer-path slices and the enlarged clean families. Composed
// slices already reviewed twice are not oversampled.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
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
    sizeSet: false,
    keep: null,
    addKinds: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--corpus') out.corpus = argv[++i];
    else if (a === '--out') out.dest = argv[++i];
    else if (a === '--size') {
      out.size = Number(argv[++i]);
      out.sizeSet = true;
    } else if (a === '--keep') out.keep = argv[++i];
    else if (a === '--add-kinds') {
      out.addKinds = argv[++i]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else throw new Error(`unknown argument ${a}`);
  }
  return out;
}

export function groupKey(row) {
  if (row.kind) {
    return `${row.family}:${row.class ?? '_'}:${row.kind}`;
  }
  if (row.family === 'positive-single') {
    return `${row.family}:${row.class}`;
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

export function isWriterRow(row) {
  if (row.path === 'composed' || row.family === 'positive-composed') return false;
  return true;
}

export function stratumFloor(key, rows, recipe) {
  let min = 1;
  const floors = recipe.reviewFloors ?? [];
  const family = key.split(':')[0];
  for (const rule of floors) {
    if (rule.when === 'writer' && rows.some(isWriterRow)) {
      const n = Number(rule.min);
      if (Number.isInteger(n) && n > min) min = n;
    }
    if (Array.isArray(rule.matchFamily) && rule.matchFamily.includes(family)) {
      const n = Number(rule.min);
      if (Number.isInteger(n) && n > min) min = n;
    }
    if (typeof rule.match === 'string' && key.includes(rule.match)) {
      const n = Number(rule.min);
      if (Number.isInteger(n) && n > min) min = n;
    }
  }
  return min;
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

  /**
   * @param {string} key
   */
  function stratumWeight(key) {
    const rules = recipe.reviewOversample ?? [];
    let weight = 1;
    for (const rule of rules) {
      if (typeof rule.match === 'string' && key.includes(rule.match)) {
        const w = Number(rule.weight);
        if (Number.isInteger(w) && w > weight) weight = w;
      }
    }
    return weight;
  }

  /** @type {typeof rows} */
  const picked = [];
  const used = new Set();
  const addKindSet = new Set(args.addKinds);
  const keepPath = args.keep;
  const rng = mulberry32(recipe.generator.seed + 17 + (keepPath ? 1 : 0));
  const cleanFamilies = new Set(
    (recipe.reviewFloors ?? []).flatMap((rule) => rule.matchFamily ?? []),
  );

  if (keepPath) {
    const keep = JSON.parse(readFileSync(keepPath, 'utf8'));
    if (!Array.isArray(keep.items) || keep.items.length === 0) {
      throw new Error(`keep sample has no items: ${keepPath}`);
    }
    for (const row of keep.items) {
      if (addKindSet.has(row.kind)) continue;
      picked.push(row);
      used.add(row.id);
    }
    const addKeys = [...groups.keys()]
      .filter((key) => groups.get(key).some((r) => addKindSet.has(r.kind)))
      .sort();
    if (addKindSet.size > 0 && addKeys.length === 0) {
      throw new Error(`--add-kinds found no corpus rows: ${[...addKindSet].join(',')}`);
    }
    const addFloor = addKeys.reduce((sum, key) => {
      const list = groups.get(key);
      return sum + Math.min(stratumFloor(key, list, recipe), list.length);
    }, 0);
    if (!args.sizeSet) {
      args.size = Math.max(picked.length + addFloor, args.size);
    }
    for (const key of addKeys) {
      const list = shuffle(groups.get(key), rng);
      const want = Math.min(stratumFloor(key, list, recipe), list.length);
      let n = 0;
      for (const row of list) {
        if (n >= want) break;
        if (used.has(row.id)) continue;
        picked.push(row);
        used.add(row.id);
        n += 1;
      }
    }
    const weightedKeys = addKeys.flatMap((key) =>
      Array.from({ length: stratumWeight(key) }, () => key),
    );
    let guard = 0;
    while (picked.length < args.size && guard < rows.length * 2) {
      guard += 1;
      let added = false;
      for (const key of weightedKeys) {
        if (picked.length >= args.size) break;
        const next = shuffle(groups.get(key), rng).find((r) => !used.has(r.id));
        if (!next) continue;
        picked.push(next);
        used.add(next.id);
        added = true;
      }
      if (!added) break;
    }
  } else {
    const keys = [...groups.keys()].sort();
    let writerStrata = 0;
    let floorSum = 0;
    for (const key of keys) {
      const list = groups.get(key);
      if (list.some(isWriterRow)) writerStrata += 1;
      floorSum += Math.min(stratumFloor(key, list, recipe), list.length);
    }
    if (writerStrata === 0 && (recipe.reviewFloors ?? []).some((r) => r.when === 'writer')) {
      console.warn(
        `writer strata 0 in ${args.corpus}; writer floor was not applied. This is not a full-corpus sample.`,
      );
      if (!args.sizeSet) args.size = floorSum;
    } else if (!args.sizeSet) {
      args.size = Math.max(args.size, floorSum);
    }
    for (const key of keys) {
      const list = shuffle(groups.get(key), rng);
      const want = Math.min(stratumFloor(key, list, recipe), list.length);
      let n = 0;
      for (const row of list) {
        if (n >= want) break;
        if (used.has(row.id)) continue;
        picked.push(row);
        used.add(row.id);
        n += 1;
      }
    }
    const fillKeys = keys.filter((key) => {
      const list = groups.get(key);
      return list.some(isWriterRow) || cleanFamilies.has(key.split(':')[0]);
    });
    const weightedKeys = (fillKeys.length > 0 ? fillKeys : keys).flatMap((key) =>
      Array.from({ length: stratumWeight(key) }, () => key),
    );
    let guard = 0;
    while (picked.length < args.size && guard < rows.length * 2) {
      guard += 1;
      let added = false;
      for (const key of weightedKeys) {
        if (picked.length >= args.size) break;
        const next = shuffle(groups.get(key), rng).find((r) => !used.has(r.id));
        if (!next) continue;
        picked.push(next);
        used.add(next.id);
        added = true;
      }
      if (!added) break;
    }
  }

  const writerN = picked.filter(isWriterRow).length;
  const composedN = picked.length - writerN;
  const cleanFamilyN = picked.filter((r) => cleanFamilies.has(r.family)).length;
  const writerMissing = writerN === 0 && (recipe.reviewFloors ?? []).some((r) => r.when === 'writer');

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
      note: keepPath
        ? 'Bounded stratified sample. Prior items kept. Only named kinds were added. Accept before any training run.'
        : writerMissing
          ? 'Pending. Sampled from a composed-only corpus. Writer-path floors were not applied. Re-sample from the training corpus once writer rows exist. Enlarged clean families are floored at 10. Accept before any training run.'
          : 'Bounded stratified sample. Writer-path slices and enlarged clean families are floored. Composed slices already reviewed twice are not oversampled. Accept before any training run.',
    },
    items: picked,
  };
  writeFileSync(args.dest, JSON.stringify(sample, null, 2) + '\n');
  console.log(`review sample ${picked.length} from ${rows.length} -> ${args.dest}`);
  console.log(`strata ${new Set(picked.map((r) => groupKey(r))).size}`);
  console.log(`writer ${writerN}, composed ${composedN}, enlarged-clean-family ${cleanFamilyN}`);
}

const isDirectRun =
  Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main();
}
