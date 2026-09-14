/**
 * Serializer latch tests for primitives evaluator training.
 * 
 * Paper: step 8. Provisional Section 3.3. The commons reference evaluation model is a trained artifact.
 * 
 * These tests verify:
 * 1. promptSha256() is deterministic and returns a consistent SHA
 * 2. fileSha256 (sha256FileHex) works correctly
 * 3. build-sft-v4.mjs correctly imports from evaluator-local (no duplicated code)
 */

import assert from "node:assert";
import { test } from "node:test";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Import from evaluator-local
const { promptSha256, sha256FileHex, buildV4System, serializeCompactPrimitives, PRIMITIVES_CATALOGUE_V1 } = require("@airp/evaluator-local");

test("promptSha256 is deterministic", () => {
  const sha1 = promptSha256();
  const sha2 = promptSha256();
  
  assert.strictEqual(sha1, sha2, "promptSha256 should return the same value on multiple calls");
  assert.strictEqual(typeof sha1, "string", "promptSha256 should return a string");
  assert.strictEqual(sha1.length, 64, "promptSha256 should return a 64-character hex string");
  assert.match(sha1, /^[0-9a-f]{64}$/, "promptSha256 should return a valid hex string");
});

test("promptSha256 matches buildV4System() content", () => {
  const prompt = buildV4System();
  const expectedSha = require("node:crypto").createHash("sha256").update(prompt, "utf8").digest("hex");
  const actualSha = promptSha256();
  
  assert.strictEqual(actualSha, expectedSha, "promptSha256 should match SHA256 of buildV4System() output");
});

test("sha256FileHex works correctly", () => {
  // Create a temporary test file
  const tempFile = path.join(here, "temp-test-file.txt");
  const testContent = "test content for SHA256";
  fs.writeFileSync(tempFile, testContent, "utf-8");
  
  try {
    const sha = sha256FileHex(tempFile);
    const expectedSha = require("node:crypto").createHash("sha256").update(testContent, "utf8").digest("hex");
    
    assert.strictEqual(sha, expectedSha, "sha256FileHex should compute correct SHA256");
    assert.strictEqual(typeof sha, "string", "sha256FileHex should return a string");
    assert.strictEqual(sha.length, 64, "sha256FileHex should return a 64-character hex string");
  } finally {
    fs.unlinkSync(tempFile);
  }
});

test("build-sft-v4.mjs imports from evaluator-local", () => {
  const buildSftPath = path.join(here, "build-sft-v4.mjs");
  const content = fs.readFileSync(buildSftPath, "utf-8");
  
  // Verify that it imports from @airp/evaluator-local
  assert.match(content, /require\("@airp\/evaluator-local"\)/, "build-sft-v4.mjs should import from @airp/evaluator-local");
  
  // Verify that it imports buildV4System
  assert.match(content, /buildV4System/, "build-sft-v4.mjs should import buildV4System");
  
  // Verify that it imports serializeCompactPrimitives
  assert.match(content, /serializeCompactPrimitives/, "build-sft-v4.mjs should import serializeCompactPrimitives");
  
  // Verify that it imports promptSha256
  assert.match(content, /promptSha256/, "build-sft-v4.mjs should import promptSha256");
  
  // Verify that it imports sha256FileHex
  assert.match(content, /sha256FileHex/, "build-sft-v4.mjs should import sha256FileHex");
  
  // Verify that duplicated code is removed (no local PRIMITIVES_CATALOGUE_V1 definition)
  const catalogueDefMatch = content.match(/const PRIMITIVES_CATALOGUE_V1\s*=\s*\{[\s\S]*vocabularyVersion:/);
  assert.strictEqual(catalogueDefMatch, null, "build-sft-v4.mjs should not have a local PRIMITIVES_CATALOGUE_V1 definition");
  
  // Verify that duplicated buildSystemPromptV4 function is removed
  assert.doesNotMatch(content, /function buildSystemPromptV4\(\)/, "build-sft-v4.mjs should not have a local buildSystemPromptV4 function");
});

test("serializeCompactPrimitives works correctly", () => {
  const verdict = {
    stance: "depicts",
    objects: ["violence_person", "sexual_activity"],
    qualifiers: ["subject_is_minor", "explicit_register"],
  };
  
  const serialized = serializeCompactPrimitives(verdict);
  
  // Expected format: stance + 7 objects (yes/no) + 10 qualifiers (yes/no)
  // stance: depicts
  // objects: violence_person=yes, self_harm=no, sexual_activity=yes, financial_crime=no, intrusion=no, weapons=no, profanity=no
  // qualifiers: targets_protected_characteristic=no, subject_is_minor=yes, asserts_interior_state=no, addresses_own_nature=no, explicit_register=yes, disclaimer_present=no, exceeds_common_knowledge=no, is_mention_not_use=no, directed_at_user=no, untethered_to_content=no
  const expected = "depicts yes no yes no no no no no yes no no yes no no no no no";
  
  assert.strictEqual(serialized, expected, "serializeCompactPrimitives should produce correct compact format");
  
  const tokens = serialized.split(" ");
  assert.strictEqual(tokens.length, 18, "serializeCompactPrimitives should produce 18 tokens");
});

test("PRIMITIVES_CATALOGUE_V1 is properly imported", () => {
  assert.ok(PRIMITIVES_CATALOGUE_V1, "PRIMITIVES_CATALOGUE_V1 should be imported");
  assert.strictEqual(PRIMITIVES_CATALOGUE_V1.vocabularyVersion, "primitives-v1", "vocabulary version should be primitives-v1");
  assert.strictEqual(PRIMITIVES_CATALOGUE_V1.stance.length, 5, "should have 5 stances");
  assert.strictEqual(PRIMITIVES_CATALOGUE_V1.objects.length, 7, "should have 7 objects");
  assert.strictEqual(PRIMITIVES_CATALOGUE_V1.qualifiers.length, 10, "should have 10 qualifiers");
});
