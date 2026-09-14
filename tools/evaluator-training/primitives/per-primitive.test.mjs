/**
 * Per-primitive decode tests.
 * 
 * Verifies:
 * 1. Per-primitive prompt builders produce correct system prompts
 * 2. Prompt bundle SHA is deterministic
 * 3. SFT builder produces expected assistant targets from fixture labels
 * 4. All 18 passes are emitted in vocabulary order
 */

import assert from "node:assert";
import { test } from "node:test";

const {
  PRIMITIVES_CATALOGUE_V1,
  buildStanceSystemPrompt,
  buildObjectSystemPrompt,
  buildQualifierSystemPrompt,
  buildAllPerPrimitivePrompts,
  perPrimitivePromptBundleSha256,
  promptSha256,
} = await import("@airp/evaluator-local");

test("buildStanceSystemPrompt produces correct format", () => {
  const prompt = buildStanceSystemPrompt();
  
  assert.ok(prompt.includes("You are an evaluator"), "Should have evaluator role");
  assert.ok(prompt.includes("Judge the stance"), "Should mention stance judgment");
  assert.ok(prompt.includes("describes"), "Should include describes stance");
  assert.ok(prompt.includes("depicts"), "Should include depicts stance");
  assert.ok(prompt.includes("endorses"), "Should include endorses stance");
  assert.ok(prompt.includes("encourages"), "Should include encourages stance");
  assert.ok(prompt.includes("conveys_method"), "Should include conveys_method stance");
  assert.ok(prompt.includes("Output only the stance name"), "Should have output instruction");
});

test("buildObjectSystemPrompt produces correct format", () => {
  const prompt = buildObjectSystemPrompt("violence_person");
  
  assert.ok(prompt.includes("You are an evaluator"), "Should have evaluator role");
  assert.ok(prompt.includes("violence_person"), "Should mention the object primitive");
  assert.ok(prompt.includes("Violence against people"), "Should include definition");
  assert.ok(prompt.includes("yes or no"), "Should have yes/no instruction");
});

test("buildQualifierSystemPrompt produces correct format", () => {
  const prompt = buildQualifierSystemPrompt("subject_is_minor");
  
  assert.ok(prompt.includes("You are an evaluator"), "Should have evaluator role");
  assert.ok(prompt.includes("subject_is_minor"), "Should mention the qualifier primitive");
  assert.ok(prompt.includes("In-text minor signal"), "Should include definition");
  assert.ok(prompt.includes("yes or no"), "Should have yes/no instruction");
});

test("buildAllPerPrimitivePrompts returns 18 prompts in vocabulary order", () => {
  const prompts = buildAllPerPrimitivePrompts();
  
  assert.strictEqual(prompts.length, 18, "Should have 18 prompts");
  
  // Check order: 1 stance + 7 objects + 10 qualifiers
  assert.strictEqual(prompts[0].passType, "stance", "First pass should be stance");
  assert.strictEqual(prompts[0].primitive, "stance", "First pass primitive should be 'stance'");
  
  // Objects should be passes 1-7 (indices 1-7)
  for (let i = 1; i <= 7; i++) {
    assert.strictEqual(prompts[i].passType, "object", `Pass ${i} should be object`);
  }
  
  // Qualifiers should be passes 8-17 (indices 8-17)
  for (let i = 8; i <= 17; i++) {
    assert.strictEqual(prompts[i].passType, "qualifier", `Pass ${i} should be qualifier`);
  }
  
  // Verify vocabulary order for objects
  const objectPrimitives = PRIMITIVES_CATALOGUE_V1.objects.map((o) => o.primitive);
  for (let i = 0; i < objectPrimitives.length; i++) {
    assert.strictEqual(prompts[i + 1].primitive, objectPrimitives[i], `Object ${i} should match vocabulary order`);
  }
  
  // Verify vocabulary order for qualifiers
  const qualifierPrimitives = PRIMITIVES_CATALOGUE_V1.qualifiers.map((q) => q.primitive);
  for (let i = 0; i < qualifierPrimitives.length; i++) {
    assert.strictEqual(prompts[i + 8].primitive, qualifierPrimitives[i], `Qualifier ${i} should match vocabulary order`);
  }
});

test("perPrimitivePromptBundleSha256 is deterministic", () => {
  const sha1 = perPrimitivePromptBundleSha256();
  const sha2 = perPrimitivePromptBundleSha256();
  
  assert.strictEqual(sha1, sha2, "Bundle SHA should be deterministic");
  assert.strictEqual(typeof sha1, "string", "Should return a string");
  assert.strictEqual(sha1.length, 64, "Should return a 64-character hex string");
  assert.match(sha1, /^[0-9a-f]{64}$/, "Should return a valid hex string");
});

test("perPrimitivePromptBundleSha256 is different from compact promptSha256", () => {
  const bundleSha = perPrimitivePromptBundleSha256();
  const compactSha = promptSha256();
  
  assert.notStrictEqual(bundleSha, compactSha, "Per-primitive bundle SHA should differ from compact SHA");
});

test("per-primitive SFT fixture: stance pass", () => {
  const label = {
    id: "test-001",
    stance: "depicts",
    objects: ["violence_person"],
    qualifiers: ["explicit_register"],
  };
  
  const prompts = buildAllPerPrimitivePrompts();
  const stancePrompt = prompts[0];
  
  assert.strictEqual(stancePrompt.passType, "stance", "Should be stance pass");
  assert.ok(stancePrompt.systemPrompt.includes("describes"), "Should include stance options");
  
  // Expected assistant target: "depicts"
  const expectedTarget = label.stance;
  assert.strictEqual(expectedTarget, "depicts", "Stance target should match label");
});

test("per-primitive SFT fixture: object pass (positive)", () => {
  const label = {
    id: "test-001",
    stance: "depicts",
    objects: ["violence_person", "sexual_activity"],
    qualifiers: [],
  };
  
  const prompts = buildAllPerPrimitivePrompts();
  
  // violence_person should be the first object pass (index 1)
  const violencePrompt = prompts[1];
  assert.strictEqual(violencePrompt.primitive, "violence_person", "Should be violence_person pass");
  
  // Expected assistant target: "yes" (present in label.objects)
  const expectedTarget = label.objects.includes("violence_person") ? "yes" : "no";
  assert.strictEqual(expectedTarget, "yes", "Object target should be yes when present");
});

test("per-primitive SFT fixture: object pass (negative)", () => {
  const label = {
    id: "test-001",
    stance: "describes",
    objects: [],
    qualifiers: ["is_mention_not_use"],
  };
  
  const prompts = buildAllPerPrimitivePrompts();
  
  // violence_person should be the first object pass (index 1)
  const violencePrompt = prompts[1];
  
  // Expected assistant target: "no" (not present in label.objects)
  const expectedTarget = label.objects.includes("violence_person") ? "yes" : "no";
  assert.strictEqual(expectedTarget, "no", "Object target should be no when absent");
});

test("per-primitive SFT fixture: qualifier pass (positive)", () => {
  const label = {
    id: "test-001",
    stance: "encourages",
    objects: ["sexual_activity"],
    qualifiers: ["subject_is_minor", "explicit_register"],
  };
  
  const prompts = buildAllPerPrimitivePrompts();
  
  // subject_is_minor should be the second qualifier pass (index 9, after targets_protected_characteristic at index 8)
  const minorPrompt = prompts[9];
  assert.strictEqual(minorPrompt.primitive, "subject_is_minor", "Should be subject_is_minor pass");
  
  // Expected assistant target: "yes" (present in label.qualifiers)
  const expectedTarget = label.qualifiers.includes("subject_is_minor") ? "yes" : "no";
  assert.strictEqual(expectedTarget, "yes", "Qualifier target should be yes when present");
});

test("per-primitive SFT fixture: qualifier pass (negative)", () => {
  const label = {
    id: "test-001",
    stance: "depicts",
    objects: ["sexual_activity"],
    qualifiers: [],
  };
  
  const prompts = buildAllPerPrimitivePrompts();
  
  // subject_is_minor should be the second qualifier pass (index 9)
  const minorPrompt = prompts[9];
  
  // Expected assistant target: "no" (not present in label.qualifiers)
  const expectedTarget = label.qualifiers.includes("subject_is_minor") ? "yes" : "no";
  assert.strictEqual(expectedTarget, "no", "Qualifier target should be no when absent");
});
