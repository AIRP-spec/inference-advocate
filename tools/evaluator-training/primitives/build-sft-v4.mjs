/**
 * Build SFT v4 jsonl for primitives evaluator training.
 * 
 * Paper: step 8. Provisional Section 3.3. The commons reference evaluation model is a trained artifact.
 * 
 * This script combines:
 * - Corpus rows (id, content from data/evaluator-training/corpus.jsonl)
 * - Primitives labels (stance, objects, qualifiers from relabel-from-slots output)
 * - Template v4 system prompt (primitives catalogue only, no taxonomy)
 * 
 * Output format: compact decode, same spirit as v3 but over primitives:
 *   stance yes/no yes/no ... (18 tokens: 1 stance + 7 objects + 10 qualifiers)
 * 
 * Usage:
 *   node build-sft-v4.mjs <corpus.jsonl> <primitives-labels.jsonl> [output.jsonl]
 * 
 * Example:
 *   node tools/evaluator-training/primitives/build-sft-v4.mjs \
 *     data/evaluator-training/corpus.jsonl \
 *     tools/evaluator-training/primitives/out/primitives-labels.jsonl \
 *     tools/evaluator-training/primitives/out/sft-primitives-v4.jsonl
 * 
 * This script does NOT mutate corpus content. It pairs corpus rows with primitives labels by id
 * and emits SFT training rows: {id, messages: [{system}, {user}, {assistant}]}.
 * 
 * Serializer latch: Single source of truth for system prompt and serialization.
 * Imports buildV4System() and serializeCompactPrimitives() from packages/evaluator-local.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Import from evaluator-local (single source of truth for system prompt).
 * Returns null if import fails (TypeScript not built).
 */
async function importEvaluatorLocal() {
  try {
    return await import("../../../packages/evaluator-local/src/prompt-v4.js");
  } catch (err) {
    return null;
  }
}

/**
 * Compute SHA256 of system prompt bytes.
 */
export function promptSha256(systemPrompt) {
  return crypto.createHash("sha256").update(systemPrompt, "utf8").digest("hex");
}

/**
 * Compute SHA256 of JSONL file bytes.
 * Used for labels latch and corpus latch.
 */
export function fileSha256(filePath) {
  const bytes = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

/**
 * Read JSONL file.
 */
function readJSONL(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return fs
    .readFileSync(filePath, "utf-8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

/**
 * Build SFT v4 jsonl from corpus + primitives labels.
 */
async function buildSFTV4(corpusPath, labelsPath, outputPath) {
  // Import from evaluator-local (single source of truth)
  const evaluatorLocal = await importEvaluatorLocal();
  if (!evaluatorLocal) {
    console.error("❌ Cannot import from evaluator-local (TypeScript not built)");
    console.error("   Run: cd packages/evaluator-local && npm run build");
    console.error("   Serializer latch requires buildV4System from evaluator-local");
    throw new Error("buildV4System not available");
  }

  const { buildV4System, serializeCompactPrimitives, PROMPT_TEMPLATE_V4 } = evaluatorLocal;

  console.log(`\n=== Building SFT v4 JSONL ===`);
  console.log(`Corpus: ${corpusPath}`);
  console.log(`Labels: ${labelsPath}`);
  console.log(`Output: ${outputPath}\n`);

  const corpus = readJSONL(corpusPath);
  const labels = readJSONL(labelsPath);

  console.log(`Corpus rows: ${corpus.length}`);
  console.log(`Label rows: ${labels.length}`);

  if (corpus.length !== labels.length) {
    throw new Error(`Corpus and labels row count mismatch: ${corpus.length} vs ${labels.length}`);
  }

  // Build ID → label map
  const idToLabel = new Map();
  for (const label of labels) {
    idToLabel.set(label.id, label);
  }

  // Use single source of truth for system prompt
  const systemPrompt = buildV4System();
  const systemSha256 = promptSha256(systemPrompt);
  
  // Compute labels and corpus SHA256 for latch
  const labelsSha256 = fileSha256(labelsPath);
  const corpusSha256 = fileSha256(corpusPath);
  
  console.log(`System prompt SHA256: ${systemSha256}`);
  console.log(`Labels SHA256: ${labelsSha256}`);
  console.log(`Corpus SHA256: ${corpusSha256}`);
  console.log(`Template version: ${PROMPT_TEMPLATE_V4}`);

  const output = [];
  let skipped = 0;

  for (const row of corpus) {
    const label = idToLabel.get(row.id);
    if (!label) {
      console.warn(`⚠️  No label found for ID: ${row.id}`);
      skipped++;
      continue;
    }

    if (!row.content) {
      console.warn(`⚠️  No content for ID: ${row.id}`);
      skipped++;
      continue;
    }

    // Use single source of truth for serialization
    const assistantVerdict = serializeCompactPrimitives(label);

    output.push({
      id: row.id,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Assistant response under evaluation:\n${row.content}` },
        { role: "assistant", content: assistantVerdict },
      ],
    });
  }

  // Write output
  fs.writeFileSync(outputPath, output.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf-8");

  // Write metadata sidecar
  const metadataPath = outputPath.replace(/\.jsonl?$/, ".meta.json");
  const metadata = {
    promptTemplateVersion: PROMPT_TEMPLATE_V4,
    promptSha256: systemSha256,
    labelsSha256,
    corpusSha256,
    vocabularyVersion: "primitives-v1",
    decodeShape: "compact-18-token",
    corpusPath,
    labelsPath,
    corpusCount: corpus.length,
    labelCount: labels.length,
    outputCount: output.length,
    skipped,
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");

  console.log(`\n✅ SFT v4 JSONL written: ${output.length} rows`);
  console.log(`✅ Metadata written: ${metadataPath}`);
  console.log(`   Prompt SHA256: ${systemSha256}`);
  console.log(`   Labels SHA256: ${labelsSha256}`);
  console.log(`   Corpus SHA256: ${corpusSha256}`);
  console.log(`   Skipped: ${skipped} rows`);

  if (output.length !== corpus.length) {
    console.warn(`\n⚠️  Output count (${output.length}) != corpus count (${corpus.length})`);
  }

  return { outputPath, metadataPath, promptSha256: systemSha256, labelsSha256, corpusSha256, count: output.length };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Usage: node build-sft-v4.mjs <corpus.jsonl> <labels.jsonl> [output.jsonl]");
    process.exit(1);
  }

  const corpusPath = args[0];
  const labelsPath = args[1];
  const outputPath = args[2] || "tools/evaluator-training/primitives/out/sft-primitives-v4.jsonl";

  buildSFTV4(corpusPath, labelsPath, outputPath).catch((err) => {
    console.error(`\n❌ Error: ${err.message}`);
    process.exit(1);
  });
}

export { buildSFTV4 };
