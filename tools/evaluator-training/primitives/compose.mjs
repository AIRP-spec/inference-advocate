/**
 * Composition layer for primitives evaluator.
 * 
 * Paper: step 8. Provisional Section 3.3.
 * 
 * This module implements the pure function compose(primitives, compositionFile) → verdicts.
 * Composition happens OUTSIDE the model prompt. Compositions are swappable at runtime without retraining.
 * 
 * The primitives evaluator outputs stance + objects + qualifiers. This layer maps those primitives
 * to taxonomy flags using composition rules.
 */

import fs from "node:fs";

/**
 * Load composition rules from a JSON file.
 */
export function loadComposition(compositionPath) {
  return JSON.parse(fs.readFileSync(compositionPath, "utf-8"));
}

/**
 * Check if primitives match a rule condition.
 */
function matchesCondition(primitives, condition) {
  // Handle allOf
  if (condition.allOf) {
    return condition.allOf.every((subcondition) => matchesCondition(primitives, subcondition));
  }

  // Handle anyOf
  if (condition.anyOf) {
    return condition.anyOf.some((subcondition) => matchesCondition(primitives, subcondition));
  }

  // Check stance
  if (condition.stance && primitives.stance !== condition.stance) {
    return false;
  }

  // Check objects (must have all listed objects)
  if (condition.objects) {
    const hasAllObjects = condition.objects.every((obj) => primitives.objects.includes(obj));
    if (!hasAllObjects) {
      return false;
    }
  }

  // Check qualifiers (must have all listed qualifiers)
  if (condition.qualifiers) {
    const hasAllQualifiers = condition.qualifiers.every((qual) => primitives.qualifiers.includes(qual));
    if (!hasAllQualifiers) {
      return false;
    }
  }

  return true;
}

/**
 * Apply negative rules (these suppress flag firing).
 */
function applyNegativeRules(primitives, negativeRules) {
  if (!negativeRules) {
    return false; // No negative rules, continue
  }

  for (const rule of negativeRules) {
    if (matchesCondition(primitives, rule.condition)) {
      return true; // Negative rule matched, suppress all flags
    }
  }

  return false;
}

/**
 * Compose primitives into taxonomy verdicts.
 * 
 * @param {Object} primitives - { stance: string, objects: string[], qualifiers: string[] }
 * @param {Object|string} composition - Composition object or path to composition JSON file
 * @returns {string[]} - Array of fired class names
 */
export function compose(primitives, composition) {
  // Load composition if path provided
  if (typeof composition === "string") {
    composition = loadComposition(composition);
  }

  const verdicts = [];

  // Check negative rules first (suppress all flags if any match)
  if (applyNegativeRules(primitives, composition.negativeRules)) {
    return verdicts; // Empty array, no flags fire
  }

  // Check each class rule
  for (const classRule of composition.classes) {
    // Skip unsupported classes
    if (classRule.unsupported || !classRule.rule) {
      continue;
    }

    // Skip classes with { none: true }
    if (classRule.rule.none) {
      continue;
    }

    // Check if primitives match the rule
    if (matchesCondition(primitives, classRule.rule)) {
      verdicts.push(classRule.class);
    }
  }

  return verdicts;
}

/**
 * Compose a batch of primitive rows.
 * 
 * @param {Array} primitiveRows - Array of { id, stance, objects, qualifiers, ... }
 * @param {Object|string} composition - Composition object or path
 * @returns {Array} - Array of { id, verdicts: string[] }
 */
export function composeBatch(primitiveRows, composition) {
  // Load composition once if path provided
  if (typeof composition === "string") {
    composition = loadComposition(composition);
  }

  return primitiveRows.map((row) => ({
    id: row.id,
    verdicts: compose(
      {
        stance: row.stance,
        objects: row.objects || [],
        qualifiers: row.qualifiers || [],
      },
      composition
    ),
  }));
}
