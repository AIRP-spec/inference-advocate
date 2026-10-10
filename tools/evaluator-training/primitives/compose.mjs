/**
 * Composition layer for primitives evaluator.
 * 
 * Paper: step 8. Provisional Section 3.3.
 * 
 * This module provides a thin CLI/wrapper that imports the shared compose function
 * from @airp/evaluator-local. The composition logic lives in a single place to prevent
 * divergence between runtime (LocalEvaluator) and build tools.
 * 
 * Single source of truth: packages/evaluator-local/src/compose-primitives.ts
 */

import fs from "node:fs";
import { compose as composeCore } from "@airp/evaluator-local";

/**
 * Load composition rules from a JSON file.
 */
export function loadComposition(compositionPath) {
  return JSON.parse(fs.readFileSync(compositionPath, "utf-8"));
}

/**
 * Compose primitives into taxonomy verdicts.
 * 
 * This is a wrapper around the shared compose function that handles file path loading.
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

  return composeCore(primitives, composition);
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
    verdicts: composeCore(
      {
        stance: row.stance,
        objects: row.objects || [],
        qualifiers: row.qualifiers || [],
      },
      composition
    ),
  }));
}
