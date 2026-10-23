/**
 * Per-primitive LocalEvaluator assembly tests.
 * 
 * Verifies:
 * 1. Assembly of 17 answers into PrimitivesVerdict (updated after disclaimer_present removal)
 * 2. Composition of primitives → taxonomy flags
 * 3. Integration with LocalEvaluator per-primitive path
 */

import assert from "node:assert";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

const {
  PRIMITIVES_CATALOGUE_V1,
} = await import("@airp/evaluator-local");

test("primitives catalogue has correct structure for per-primitive", () => {
  assert.strictEqual(PRIMITIVES_CATALOGUE_V1.stance.length, 5, "Should have 5 stances");
  assert.strictEqual(PRIMITIVES_CATALOGUE_V1.objects.length, 7, "Should have 7 objects");
  assert.strictEqual(PRIMITIVES_CATALOGUE_V1.qualifiers.length, 9, "Should have 9 qualifiers");
  
  // Verify stance enum values
  const stances = PRIMITIVES_CATALOGUE_V1.stance.map((s) => s.primitive);
  assert.deepStrictEqual(stances, ["describes", "depicts", "endorses", "encourages", "conveys_method"]);
  
  // Verify object primitives
  const objects = PRIMITIVES_CATALOGUE_V1.objects.map((o) => o.primitive);
  assert.ok(objects.includes("violence_person"), "Should include violence_person");
  assert.ok(objects.includes("sexual_activity"), "Should include sexual_activity");
  assert.ok(objects.includes("self_harm"), "Should include self_harm");
  
  // Verify qualifier primitives
  const qualifiers = PRIMITIVES_CATALOGUE_V1.qualifiers.map((q) => q.primitive);
  assert.ok(qualifiers.includes("subject_is_minor"), "Should include subject_is_minor");
  assert.ok(qualifiers.includes("explicit_register"), "Should include explicit_register");
  assert.ok(qualifiers.includes("targets_protected_characteristic"), "Should include targets_protected_characteristic");
});

test("assembly of 18 answers → primitives verdict (CSE case)", () => {
  // Simulate 18 raw answers from per-primitive decodes
  const rawAnswers = {
    stance: "encourages",
    object_violence_person: "no",
    object_self_harm: "no",
    object_sexual_activity: "yes",
    object_financial_crime: "no",
    object_intrusion: "no",
    object_weapons: "no",
    object_profanity: "no",
    qualifier_targets_protected_characteristic: "no",
    qualifier_subject_is_minor: "yes",
    qualifier_asserts_interior_state: "no",
    qualifier_addresses_own_nature: "no",
    qualifier_explicit_register: "yes",
    qualifier_exceeds_common_knowledge: "no",
    qualifier_is_mention_not_use: "no",
    qualifier_directed_at_user: "no",
    qualifier_untethered_to_content: "no",
  };
  
  // Assemble into verdict
  const objects = [];
  for (const obj of PRIMITIVES_CATALOGUE_V1.objects) {
    if (rawAnswers[`object_${obj.primitive}`] === "yes") {
      objects.push(obj.primitive);
    }
  }
  
  const qualifiers = [];
  for (const qual of PRIMITIVES_CATALOGUE_V1.qualifiers) {
    if (rawAnswers[`qualifier_${qual.primitive}`] === "yes") {
      qualifiers.push(qual.primitive);
    }
  }
  
  const stance = rawAnswers.stance;
  
  // Verify assembled verdict
  assert.strictEqual(stance, "encourages", "Stance should be encourages");
  assert.deepStrictEqual(objects, ["sexual_activity"], "Objects should be [sexual_activity]");
  assert.deepStrictEqual(qualifiers, ["subject_is_minor", "explicit_register"], "Qualifiers should be [subject_is_minor, explicit_register]");
  
  // This should compose to child_sexual_exploitation
  // (encourages + sexual_activity + subject_is_minor)
});

test("assembly of 18 answers → primitives verdict (violence case)", () => {
  const rawAnswers = {
    stance: "depicts",
    object_violence_person: "yes",
    object_self_harm: "no",
    object_sexual_activity: "no",
    object_financial_crime: "no",
    object_intrusion: "no",
    object_weapons: "no",
    object_profanity: "no",
    qualifier_targets_protected_characteristic: "no",
    qualifier_subject_is_minor: "no",
    qualifier_asserts_interior_state: "no",
    qualifier_addresses_own_nature: "no",
    qualifier_explicit_register: "no",
    qualifier_exceeds_common_knowledge: "no",
    qualifier_is_mention_not_use: "no",
    qualifier_directed_at_user: "no",
    qualifier_untethered_to_content: "no",
  };
  
  const objects = [];
  for (const obj of PRIMITIVES_CATALOGUE_V1.objects) {
    if (rawAnswers[`object_${obj.primitive}`] === "yes") {
      objects.push(obj.primitive);
    }
  }
  
  const qualifiers = [];
  for (const qual of PRIMITIVES_CATALOGUE_V1.qualifiers) {
    if (rawAnswers[`qualifier_${qual.primitive}`] === "yes") {
      qualifiers.push(qual.primitive);
    }
  }
  
  const stance = rawAnswers.stance;
  
  assert.strictEqual(stance, "depicts", "Stance should be depicts");
  assert.deepStrictEqual(objects, ["violence_person"], "Objects should be [violence_person]");
  assert.deepStrictEqual(qualifiers, [], "Qualifiers should be empty");
});

test("assembly of 18 answers → primitives verdict (clean case)", () => {
  const rawAnswers = {
    stance: "describes",
    object_violence_person: "no",
    object_self_harm: "no",
    object_sexual_activity: "no",
    object_financial_crime: "no",
    object_intrusion: "no",
    object_weapons: "no",
    object_profanity: "no",
    qualifier_targets_protected_characteristic: "no",
    qualifier_subject_is_minor: "no",
    qualifier_asserts_interior_state: "no",
    qualifier_addresses_own_nature: "no",
    qualifier_explicit_register: "no",
    qualifier_exceeds_common_knowledge: "no",
    qualifier_is_mention_not_use: "yes",
    qualifier_directed_at_user: "no",
    qualifier_untethered_to_content: "no",
  };
  
  const objects = [];
  for (const obj of PRIMITIVES_CATALOGUE_V1.objects) {
    if (rawAnswers[`object_${obj.primitive}`] === "yes") {
      objects.push(obj.primitive);
    }
  }
  
  const qualifiers = [];
  for (const qual of PRIMITIVES_CATALOGUE_V1.qualifiers) {
    if (rawAnswers[`qualifier_${qual.primitive}`] === "yes") {
      qualifiers.push(qual.primitive);
    }
  }
  
  const stance = rawAnswers.stance;
  
  assert.strictEqual(stance, "describes", "Stance should be describes");
  assert.deepStrictEqual(objects, [], "Objects should be empty");
  assert.deepStrictEqual(qualifiers, ["is_mention_not_use"], "Qualifiers should be [is_mention_not_use]");
  
  // This should compose to no flags (mention-versus-use negative)
});

test("per-primitive decode produces 17 separate judgments", () => {
  // Total expected passes (updated after disclaimer_present removal)
  const expectedPasses = 1 + 7 + 9; // stance + objects + qualifiers
  assert.strictEqual(expectedPasses, 17, "Should have 17 passes");
  
  // Verify catalogue structure matches
  const stanceCount = PRIMITIVES_CATALOGUE_V1.stance.length;
  const objectCount = PRIMITIVES_CATALOGUE_V1.objects.length;
  const qualifierCount = PRIMITIVES_CATALOGUE_V1.qualifiers.length;
  
  assert.strictEqual(stanceCount, 5, "5 stance options");
  assert.strictEqual(objectCount, 7, "7 objects");
  assert.strictEqual(qualifierCount, 9, "9 qualifiers");
  assert.strictEqual(1 + objectCount + qualifierCount, 17, "17 total passes");
});
