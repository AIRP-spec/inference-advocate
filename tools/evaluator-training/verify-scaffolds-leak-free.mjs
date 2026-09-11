#!/usr/bin/env node
// Verify that all training scaffolds are leak-free against held-out suite v2.
//
// Paper: step 8. The held-out suite is never trained against. This script
// checks that scaffold texts (composed contrast items and other fixed training
// strings) do not leak held-out content through exact match, substring, or
// 4-gram Jaccard similarity.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildLeakIndex,
  leakReason,
  loadHeldOutContentsFromSuite,
} from './leak.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const recipe = JSON.parse(readFileSync(join(here, 'recipe.json'), 'utf8'));
const heldOutPath = join(repoRoot, recipe.heldOutSuite);
const index = buildLeakIndex(loadHeldOutContentsFromSuite(heldOutPath));

console.log(`Checking scaffolds against ${recipe.heldOutSuite}...`);

// Collect all scaffold files
const scaffoldFiles = readdirSync(here)
  .filter((f) => f.endsWith('.json') && (f.includes('scaffold') || f.includes('contrast')))
  .map((f) => join(here, f));

let totalChecked = 0;
let leakCount = 0;
const leaks = [];

for (const file of scaffoldFiles) {
  const filename = file.split('/').pop();
  const scaffold = JSON.parse(readFileSync(file, 'utf8'));
  
  // Extract all text content from the scaffold
  const texts = [];
  
  if (scaffold.items && Array.isArray(scaffold.items)) {
    for (const item of scaffold.items) {
      // Handle different scaffold structures
      if (typeof item === 'string') {
        texts.push(item);
      } else if (typeof item === 'object') {
        for (const key of Object.keys(item)) {
          if (typeof item[key] === 'string' && item[key].length > 10) {
            texts.push(item[key]);
          }
        }
      }
    }
  }
  
  // Check scaffolds with templates and stems
  if (scaffold.stems && Array.isArray(scaffold.stems)) {
    texts.push(...scaffold.stems);
  }
  if (scaffold.templates && Array.isArray(scaffold.templates)) {
    for (const template of scaffold.templates) {
      if (typeof template === 'string') {
        // Remove template variables like {{var}} for checking
        const cleanText = template.replace(/\{\{[^}]+\}\}/g, '').trim();
        if (cleanText.length > 10) {
          texts.push(cleanText);
        }
      }
    }
  }
  
  // Check all extracted texts
  for (const text of texts) {
    totalChecked++;
    const reason = leakReason(text, index);
    if (reason) {
      leakCount++;
      leaks.push(`${filename}: ${reason} - "${text.slice(0, 60)}..."`);
    }
  }
}

if (leakCount > 0) {
  console.error(`\n❌ Scaffold leak check FAILED (${leakCount} leaks in ${scaffoldFiles.length} files):`);
  console.error(leaks.slice(0, 20).join('\n'));
  if (leaks.length > 20) {
    console.error(`... and ${leaks.length - 20} more`);
  }
  process.exit(1);
}

console.log(`✅ Scaffold leak check PASSED: ${totalChecked} strings checked across ${scaffoldFiles.length} files, 0 held-out collisions`);
