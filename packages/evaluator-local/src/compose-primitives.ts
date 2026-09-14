/**
 * Composition layer for primitives evaluator.
 * 
 * Single source of truth for composition logic.
 * Used by both LocalEvaluator (runtime) and build tools (SFT generation, testing).
 * 
 * Policy:
 * - is_mention_not_use: Suppresses flags ONLY when stance is "describes" (true mention).
 *   Production stances (depicts/encourages/endorses/conveys_method) override.
 * - disclaimer_present: Full wipe regardless of stance.
 */

export interface PrimitivesVerdict {
  stance: string;
  objects: string[];
  qualifiers: string[];
}

export interface CompositionCondition {
  stance?: string;
  objects?: string[];
  qualifiers?: string[];
  allOf?: CompositionCondition[];
  anyOf?: CompositionCondition[];
}

export interface NegativeRule {
  condition: CompositionCondition;
  fires: string[];
  note?: string;
}

export interface ClassRule {
  class: string;
  definition?: string;
  rule: CompositionCondition;
  unsupported?: boolean;
  note?: string;
}

export interface Composition {
  compositionVersion: string;
  targetTaxonomy: string;
  date: string;
  note?: string;
  classes: ClassRule[];
  negativeRules?: NegativeRule[];
}

/**
 * Check if primitives match a condition.
 */
function matchesCondition(primitives: PrimitivesVerdict, condition: CompositionCondition): boolean {
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
 * 
 * Policy:
 * - is_mention_not_use: Suppresses flags ONLY when stance is "describes" (true mention).
 *   If stance is depicts/encourages/endorses/conveys_method (production stance), do not suppress.
 * - disclaimer_present: Suppresses all flags regardless of stance (full wipe).
 */
function applyNegativeRules(primitives: PrimitivesVerdict, negativeRules?: NegativeRule[]): boolean {
  if (!negativeRules) {
    return false; // No negative rules, continue
  }

  for (const rule of negativeRules) {
    if (matchesCondition(primitives, rule.condition)) {
      // Special policy for is_mention_not_use: only suppress when stance is "describes"
      if (rule.condition.qualifiers && rule.condition.qualifiers.includes('is_mention_not_use')) {
        if (primitives.stance === 'describes') {
          return true; // Suppress flags (true mention)
        }
        // Production stance (depicts/encourages/endorses/conveys_method): do not suppress
        continue;
      }
      
      // All other negative rules: full wipe
      return true; // Negative rule matched, suppress all flags
    }
  }

  return false;
}

/**
 * Compose primitives into taxonomy verdicts.
 * 
 * Single source of truth for composition logic.
 * Used by LocalEvaluator (runtime) and build tools.
 * 
 * @param primitives - { stance: string, objects: string[], qualifiers: string[] }
 * @param composition - Composition object
 * @returns Array of fired class names
 */
export function compose(primitives: PrimitivesVerdict, composition: Composition): string[] {
  const verdicts: string[] = [];

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
    if ((classRule.rule as any).none) {
      continue;
    }

    // Check if primitives match the rule
    if (matchesCondition(primitives, classRule.rule)) {
      verdicts.push(classRule.class);
    }
  }

  return verdicts;
}
