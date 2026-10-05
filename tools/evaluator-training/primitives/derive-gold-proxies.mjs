#!/usr/bin/env node
// Derive gold proxies for primitives from composition rules.
//
// Paper: Shared fix for Task 1 and Task 2.
// Each primitive's gold proxy maps to which taxonomy classes require that primitive
// based on the composition rules in airp-v0.5.0.json.
//
// This derivation is deterministic from the composition file. The brief requires
// checking this against per-atom-precision-converged.json from the Qwen audit,
// but that file is not accessible (Nepal VPS unreachable). This script derives
// the proxies from composition rules alone and documents the limitation.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../..');

// Load composition and taxonomy
const compositionPath = join(repoRoot, 'tools/evaluator-training/primitives/compositions/airp-v0.5.0.json');
const flagsPath = join(repoRoot, 'data/taxonomy/flags.v0.json');

const composition = JSON.parse(readFileSync(compositionPath, 'utf8'));
const flags = JSON.parse(readFileSync(flagsPath, 'utf8'));

// Validate all classes in composition are in flags.v0.json
const validClasses = new Set(flags.flags.map(f => f.type));
const allClassesInComposition = new Set();
for (const classRule of composition.classes) {
  allClassesInComposition.add(classRule.class);
}

// Check composition classes are all valid
for (const cls of allClassesInComposition) {
  if (!validClasses.has(cls)) {
    console.error(`ERROR: Composition references unknown class "${cls}" not in flags.v0.json`);
    console.error(`Valid classes: ${Array.from(validClasses).join(', ')}`);
    process.exit(1);
  }
}

console.log(`✓ All ${allClassesInComposition.size} classes in composition are valid`);
console.log(`Valid classes: ${Array.from(validClasses).sort().join(', ')}\n`);

// Derive gold proxies by analyzing composition rules
// For each primitive, determine which classes require it

const goldProxies = {};

// Helper to extract primitives from a rule
function extractPrimitivesFromRule(rule, path = []) {
  const result = {
    stance: null,
    objects: new Set(),
    qualifiers: new Set(),
  };

  if (!rule) return result;

  // Handle direct primitive specifications
  if (rule.stance) {
    result.stance = rule.stance;
  }
  if (rule.objects) {
    rule.objects.forEach(obj => result.objects.add(obj));
  }
  if (rule.qualifiers) {
    rule.qualifiers.forEach(qual => result.qualifiers.add(qual));
  }

  // Recursively handle anyOf/allOf
  if (rule.anyOf) {
    for (const subRule of rule.anyOf) {
      const subResult = extractPrimitivesFromRule(subRule, [...path, 'anyOf']);
      if (subResult.stance) result.stance = result.stance || subResult.stance;
      subResult.objects.forEach(obj => result.objects.add(obj));
      subResult.qualifiers.forEach(qual => result.qualifiers.add(qual));
    }
  }
  if (rule.allOf) {
    for (const subRule of rule.allOf) {
      const subResult = extractPrimitivesFromRule(subRule, [...path, 'allOf']);
      if (subResult.stance) result.stance = result.stance || subResult.stance;
      subResult.objects.forEach(obj => result.objects.add(obj));
      subResult.qualifiers.forEach(qual => result.qualifiers.add(qual));
    }
  }

  return result;
}

// Build reverse mapping: primitive -> classes that require it
const primitiveToClasses = {
  // Stance is special - it's always present but with different values
  stance: new Set(),
  // Objects
  violence_person: new Set(),
  self_harm: new Set(),
  sexual_activity: new Set(),
  financial_crime: new Set(),
  intrusion: new Set(),
  weapons: new Set(),
  profanity: new Set(),
  // Qualifiers
  targets_protected_characteristic: new Set(),
  subject_is_minor: new Set(),
  asserts_interior_state: new Set(),
  addresses_own_nature: new Set(),
  explicit_register: new Set(),
  exceeds_common_knowledge: new Set(),
  is_mention_not_use: new Set(),
  directed_at_user: new Set(),
  untethered_to_content: new Set(),
};

// Analyze each class's composition rule
for (const classRule of composition.classes) {
  const className = classRule.class;
  const primitives = extractPrimitivesFromRule(classRule.rule);

  // Stance - track which stances are used
  if (primitives.stance) {
    primitiveToClasses.stance.add(className);
  }

  // Objects
  primitives.objects.forEach(obj => {
    if (primitiveToClasses[obj]) {
      primitiveToClasses[obj].add(className);
    }
  });

  // Qualifiers
  primitives.qualifiers.forEach(qual => {
    if (primitiveToClasses[qual]) {
      primitiveToClasses[qual].add(className);
    }
  });
}

// Generate gold proxies
// For binary primitives (objects/qualifiers), proxy is: expect includes any of the requiring classes
// For stance, it's a distribution (no binary proxy)

const proxies = {};

// Objects and qualifiers
for (const [primitive, classes] of Object.entries(primitiveToClasses)) {
  if (primitive === 'stance') continue; // Stance is not binary

  const classArray = Array.from(classes).sort();
  if (classArray.length === 0) {
    proxies[primitive] = {
      type: primitive.includes('_') && !primitive.startsWith('is_') ? 'qualifier' : 'object',
      goldProxy: null,
      note: 'No classes in composition require this primitive',
      requiringClasses: [],
    };
  } else {
    proxies[primitive] = {
      type: primitive.startsWith('is_') || primitive.startsWith('subject_') || primitive.startsWith('targets_') || primitive.startsWith('asserts_') || primitive.startsWith('addresses_') || primitive.startsWith('explicit_') || primitive.startsWith('exceeds_') || primitive.startsWith('directed_') || primitive.startsWith('untethered_') ? 'qualifier' : 'object',
      goldProxy: `expect includes any of: [${classArray.map(c => `"${c}"`).join(', ')}]`,
      requiringClasses: classArray,
    };
  }
}

// Add stance (special case - not a binary proxy)
proxies.stance = {
  type: 'stance',
  goldProxy: null,
  note: 'Stance is a 5-way choice, not binary. No single gold proxy.',
  stanceDistribution: 'Analyze per-item stance against expect composition',
};

// Output
const output = {
  version: '0.5.0',
  derivedFrom: {
    composition: 'tools/evaluator-training/primitives/compositions/airp-v0.5.0.json',
    compositionSha256: hashFile(compositionPath),
    taxonomy: 'data/taxonomy/flags.v0.json',
    taxonomySha256: hashFile(flagsPath),
    method: 'Derived by analyzing which classes in the composition file require each primitive',
  },
  limitations: [
    'This derivation is from composition rules only.',
    'The brief requires checking against per-atom-precision-converged.json from the Qwen audit.',
    'That file is not accessible (Nepal VPS himalogic.com unreachable).',
    'If per-atom-precision-converged.json differs, those proxies are authoritative.',
  ],
  note: 'exceeds_common_knowledge proxy (expect includes criminal_assistance) counts self-harm method items as false positives, even though 56 self-harm method rows in the corpus carry that atom. This understates true precision for both models equally (brief point 4).',
  primitives: proxies,
};

// Write output
const outputPath = join(here, 'gold-proxies.v0.5.0.json');
writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');

// Calculate and display SHA-256
const outputSha = hashFile(outputPath);
console.log(`\nDerived gold proxies for ${Object.keys(proxies).length} primitives`);
console.log(`Wrote: ${outputPath}`);
console.log(`SHA-256: ${outputSha}\n`);

// Display summary
console.log('Summary by primitive:');
console.log('  stance: (5-way choice, not binary)');
for (const [prim, info] of Object.entries(proxies).sort()) {
  if (prim === 'stance') continue;
  if (info.requiringClasses.length === 0) {
    console.log(`  ${prim.padEnd(40)} → (no classes require)`);
  } else {
    console.log(`  ${prim.padEnd(40)} → ${info.requiringClasses.join(', ')}`);
  }
}

// Verify specific proxies mentioned in the brief
console.log('\nVerifying brief-mentioned proxies:');
console.log(`  exceeds_common_knowledge → ${proxies.exceeds_common_knowledge.requiringClasses.join(', ')}`);
if (proxies.exceeds_common_knowledge.requiringClasses.includes('criminal_assistance')) {
  console.log('    ✓ Matches brief statement (expect includes criminal_assistance)');
} else {
  console.log('    ✗ MISMATCH with brief statement');
}

console.log(`  subject_is_minor → ${proxies.subject_is_minor.requiringClasses.join(', ')}`);
if (proxies.subject_is_minor.requiringClasses.includes('child_sexual_exploitation')) {
  console.log('    ✓ Matches gate.mjs CSE proxy');
} else {
  console.log('    ✗ MISMATCH with gate.mjs');
}

console.log(`  directed_at_user → ${proxies.directed_at_user.requiringClasses.join(', ')}`);
if (proxies.directed_at_user.requiringClasses.length === 0 || !proxies.directed_at_user.requiringClasses.includes('harassment')) {
  console.log('    ✓ Correctly shows NO harassment class (this was the bug)');
} else {
  console.log('    ✗ Incorrectly includes harassment');
}

function hashFile(path) {
  const content = readFileSync(path);
  return createHash('sha256').update(content).digest('hex');
}
