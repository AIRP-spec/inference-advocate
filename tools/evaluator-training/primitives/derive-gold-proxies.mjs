#!/usr/bin/env node
/**
 * Derives gold proxies for each primitive from the composition file.
 * 
 * Section: Shared fix for Task 1 and Task 2 (brief-2026-10-05.md)
 * Step: Derive per-primitive gold proxies from airp-v0.5.0.json composition
 * 
 * For each primitive, identifies which of the 11 valid AIRP v0.5.0 classes
 * require that primitive in their composition rules.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// The 11 valid classes from flags.v0.json (AIRP v0.5.0)
const VALID_CLASSES = [
  'persona_claims',
  'relational_hooks', 
  'sycophancy',
  'simulation_obscured',
  'profanity',
  'self_harm',
  'sexual_content',
  'child_sexual_exploitation',
  'violence',
  'hate',
  'criminal_assistance'
];

// Read composition file
const compositionPath = 'tools/evaluator-training/primitives/compositions/airp-v0.5.0.json';
const composition = JSON.parse(readFileSync(compositionPath, 'utf8'));

// Read flags file to verify valid classes
const flagsPath = 'data/taxonomy/flags.v0.json';
const flags = JSON.parse(readFileSync(flagsPath, 'utf8'));
const flagTypes = flags.flags.map(f => f.type).sort();

// Verify VALID_CLASSES matches flags.v0.json
console.log('Verifying valid classes against flags.v0.json...');
const validClassesSet = new Set(VALID_CLASSES);
const flagTypesSet = new Set(flagTypes);

if (VALID_CLASSES.length !== flagTypes.length) {
  throw new Error(`Class count mismatch: VALID_CLASSES has ${VALID_CLASSES.length}, flags.v0.json has ${flagTypes.length}`);
}

for (const cls of VALID_CLASSES) {
  if (!flagTypesSet.has(cls)) {
    throw new Error(`Class "${cls}" in VALID_CLASSES not found in flags.v0.json`);
  }
}
console.log(`✅ All ${VALID_CLASSES.length} classes verified\n`);

// Extract all primitives mentioned in composition rules
function extractPrimitivesFromRule(rule, primitives = new Set()) {
  if (!rule) return primitives;
  
  if (rule.stance) {
    primitives.add('stance:' + rule.stance);
  }
  if (rule.objects) {
    for (const obj of rule.objects) {
      primitives.add('object:' + obj);
    }
  }
  if (rule.qualifiers) {
    for (const qual of rule.qualifiers) {
      primitives.add('qualifier:' + qual);
    }
  }
  
  if (rule.anyOf) {
    for (const subrule of rule.anyOf) {
      extractPrimitivesFromRule(subrule, primitives);
    }
  }
  if (rule.allOf) {
    for (const subrule of rule.allOf) {
      extractPrimitivesFromRule(subrule, primitives);
    }
  }
  
  return primitives;
}

// Build reverse mapping: primitive -> classes that require it
const goldProxies = {
  derivedFrom: 'compositions/airp-v0.5.0.json',
  note: 'Gold proxies for per-primitive precision/recall. Each primitive lists the AIRP v0.5.0 classes whose composition rules require that primitive. A model firing a primitive should fire these classes (when other conditions are met).',
  primitives: {}
};

// For each class, extract required primitives
const classesToPrimitives = {};
for (const classSpec of composition.classes) {
  const className = classSpec.class;
  
  // Verify class is valid
  if (!validClassesSet.has(className)) {
    throw new Error(`Unknown class "${className}" in composition file. Valid classes: ${VALID_CLASSES.join(', ')}`);
  }
  
  const primitives = extractPrimitivesFromRule(classSpec.rule);
  classesToPrimitives[className] = Array.from(primitives).sort();
  
  console.log(`${className}: ${Array.from(primitives).join(', ')}`);
}

console.log('\n--- Deriving primitive -> classes mapping ---\n');

// Invert: for each primitive, which classes require it?
const primitivesToClasses = {};

for (const [className, primitives] of Object.entries(classesToPrimitives)) {
  for (const primitive of primitives) {
    if (!primitivesToClasses[primitive]) {
      primitivesToClasses[primitive] = [];
    }
    primitivesToClasses[primitive].push(className);
  }
}

// Sort and format
const sortedPrimitives = Object.keys(primitivesToClasses).sort();
for (const primitive of sortedPrimitives) {
  const classes = primitivesToClasses[primitive].sort();
  goldProxies.primitives[primitive] = {
    expectIncludes: classes,
    note: `Classes requiring ${primitive}`
  };
  console.log(`${primitive} → expect includes ${classes.join(', ')}`);
}

// Special case: directed_at_user caveat from brief
// The brief notes that exceeds_common_knowledge proxy counts self_harm method 
// items as false positives even though 56 corpus rows have that atom.
// This is documented but not changed.
if (goldProxies.primitives['qualifier:exceeds_common_knowledge']) {
  goldProxies.primitives['qualifier:exceeds_common_knowledge'].caveat = 
    'Counts self_harm method items as false positives (56 corpus rows carry this atom but composition requires criminal_assistance). This understates true precision equally for all models.';
}

// Write output with stable formatting
const outputPath = 'tools/evaluator-training/primitives/gold-proxies.v0.5.0.json';
const output = JSON.stringify(goldProxies, null, 2) + '\n';
writeFileSync(outputPath, output, 'utf8');

// Calculate SHA-256
const hash = createHash('sha256');
hash.update(output);
const sha256 = hash.digest('hex');

console.log(`\n✅ Gold proxies written to ${outputPath}`);
console.log(`📝 SHA-256: ${sha256}`);
console.log(`\nVerify with: sha256sum ${outputPath}`);
