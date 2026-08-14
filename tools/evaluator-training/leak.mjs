#!/usr/bin/env node
// Held-out separation for the training generator.
//
// Paper: step 8. The held-out suite is never trained against. Exact match is the
// minimum check. Substring and 4-gram Jaccard catch copies that changed a comma.

import { readFileSync } from 'node:fs';

/**
 * @param {string} s
 */
export function normalizeContent(s) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * @param {string} s
 * @param {number} n
 * @returns {Set<string>}
 */
export function wordNgrams(s, n = 4) {
  const words = normalizeContent(s).split(' ').filter(Boolean);
  /** @type {Set<string>} */
  const out = new Set();
  if (words.length < n) return out;
  for (let i = 0; i <= words.length - n; i++) {
    out.add(words.slice(i, i + n).join(' '));
  }
  return out;
}

/**
 * @param {Set<string>} a
 * @param {Set<string>} b
 */
export function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  return inter / (a.size + b.size - inter);
}

/**
 * @param {string[]} contents
 */
export function buildLeakIndex(contents) {
  const exact = new Set(contents.map(normalizeContent));
  const entries = contents.map((content) => ({
    content,
    norm: normalizeContent(content),
    grams: wordNgrams(content, 4),
  }));
  return { exact, entries };
}

/**
 * @param {string} content
 * @param {{ exact: Set<string>, entries: Array<{ content: string, norm: string, grams: Set<string> }> }} index
 * @param {number} [jaccardLimit]
 * @returns {string | null} reason, or null if clean
 */
export function leakReason(content, index, jaccardLimit = 0.5) {
  const norm = normalizeContent(content);
  if (!norm) return 'empty';
  if (index.exact.has(norm)) return 'exact-held-out';
  const grams = wordNgrams(content, 4);
  for (const entry of index.entries) {
    if (norm.length >= 40 && entry.norm.length >= 40) {
      if (norm.includes(entry.norm) || entry.norm.includes(norm)) return 'substring-held-out';
    }
    if (entry.grams.size >= 3 && jaccard(grams, entry.grams) >= jaccardLimit) {
      return 'ngram-held-out';
    }
  }
  return null;
}

/**
 * @param {string} path
 * @returns {string[]}
 */
export function loadHeldOutContentsFromSuite(path) {
  const suite = JSON.parse(readFileSync(path, 'utf8'));
  if (!Array.isArray(suite.items)) throw new Error(`no items in ${path}`);
  return suite.items.map((item) => {
    if (typeof item.content !== 'string') throw new Error('held-out item missing content');
    return item.content;
  });
}
