/**
 * Build SFT per-primitive-v1 jsonl for primitives evaluator training.
 * 
 * Paper: step 8. Provisional Section 3.3. The commons reference evaluation model is a trained artifact.
 * 
 * Decode shape: per-primitive-v1
 * - 18 separate judgments per utterance (1 stance + 7 objects + 10 qualifiers)
 * - Each pass: short system prompt with only that question's definition
 * - User: assistant response under evaluation
 * - Assistant: single token line (stance name or yes/no)
 * 
 * This script emits 18 SFT examples per corpus row.
 * 
 * Usage:
 *   node build-sft-per-primitive.mjs <corpus.jsonl> <primitives-labels.jsonl> [output.jsonl]
 * 
 * Example:
 *   node tools/evaluator-training/primitives/build-sft-per-primitive.mjs \
 *     data/evaluator-training/corpus.jsonl \
 *     tools/evaluator-training/primitives/out/primitives-labels.jsonl \
 *     tools/evaluator-training/primitives/out/sft-per-primitive-v1.jsonl
 */

import fs from "node:fs";
import path from "node:path";

const {
  PRIMITIVES_CATALOGUE_V1,
  buildAllPerPrimitivePrompts,
  perPrimitivePromptBundleSha256,
  sha256FileHex,
} = await import("@airp/evaluator-local");

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
 * Build per-primitive user prompt (same for all 18 passes).
 */
function buildUserPrompt(content) {
  return `Assistant response under evaluation:\n${content}`;
}

/**
 * Get assistant target for stance pass.
 */
function getStanceTarget(label) {
  return label.stance;
}

/**
 * Get assistant target for object pass.
 */
function getObjectTarget(label, objectPrimitive) {
  return label.objects.includes(objectPrimitive) ? "yes" : "no";
}

/**
 * Get assistant target for qualifier pass.
 */
function getQualifierTarget(label, qualifierPrimitive) {
  return label.qualifiers.includes(qualifierPrimitive) ? "yes" : "no";
}

/**
 * Build SFT per-primitive-v1 jsonl from corpus + primitives labels.
 */
async function buildSFTPerPrimitive(corpusPath, labelsPath, outputPath) {
  console.log(`\n=== Building SFT per-primitive-v1 JSONL ===`);
  console.log(`Corpus: ${corpusPath}`);
  console.log(`Labels: ${labelsPath}`);
  console.log(`Output: ${outputPath}\n`);

  const corpus = readJSONL(corpusPath);
  const labels = readJSONL(labelsPath);

  console.log(`Corpus rows: ${corpus.length}`);
  console.log(`Label rows: ${labels.length}`);

  // Build ID → label map
  const idToLabel = new Map();
  for (const label of labels) {
    idToLabel.set(label.id, label);
  }

  // Get all 18 per-primitive prompts in vocabulary order
  const prompts = buildAllPerPrimitivePrompts();
  console.log(`Per-primitive passes: ${prompts.length}`);

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

    const userPrompt = buildUserPrompt(row.content);

    // Emit 18 SFT examples (one per pass)
    for (const promptSpec of prompts) {
      let assistantTarget;
      if (promptSpec.passType === "stance") {
        assistantTarget = getStanceTarget(label);
      } else if (promptSpec.passType === "object") {
        assistantTarget = getObjectTarget(label, promptSpec.primitive);
      } else if (promptSpec.passType === "qualifier") {
        assistantTarget = getQualifierTarget(label, promptSpec.primitive);
      } else {
        throw new Error(`Unknown pass type: ${promptSpec.passType}`);
      }

      output.push({
        id: `${row.id}__${promptSpec.primitive}`,
        sourceId: row.id,
        passType: promptSpec.passType,
        primitive: promptSpec.primitive,
        messages: [
          { role: "system", content: promptSpec.systemPrompt },
          { role: "user", content: userPrompt },
          { role: "assistant", content: assistantTarget },
        ],
      });
    }
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, output.map((r) => JSON.stringify(r)).join("\n"), "utf-8");

  // Write metadata file
  const metadataPath = outputPath.replace(/\.jsonl?$/, ".meta.json");
  const metadata = {
    promptBundleSha256: perPrimitivePromptBundleSha256(),
    labelsSha256: sha256FileHex(labelsPath),
    corpusSha256: sha256FileHex(corpusPath),
    promptTemplateVersion: "per-primitive-v1",
    vocabularyVersion: PRIMITIVES_CATALOGUE_V1.vocabularyVersion,
    decodeShape: "per-primitive-v1",
    passesPerUtterance: prompts.length,
    paths: {
      corpus: corpusPath,
      labels: labelsPath,
      sft: outputPath,
    },
    counts: {
      corpusRows: corpus.length - skipped,
      totalSFTRows: output.length,
      skipped: skipped,
      passesPerUtterance: prompts.length,
    },
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");

  console.log(`\nSFT per-primitive-v1 JSONL built:`);
  console.log(`  Corpus rows processed: ${corpus.length - skipped}`);
  console.log(`  Total SFT examples: ${output.length} (${prompts.length} passes × ${corpus.length - skipped} rows)`);
  console.log(`  Skipped (no label or content): ${skipped}`);
  console.log(`  Output: ${outputPath}`);
  console.log(`  Metadata: ${metadataPath}`);
  console.log(`  Prompt Bundle SHA256: ${metadata.promptBundleSha256}`);
  console.log(`  Labels SHA256: ${metadata.labelsSha256}`);
  console.log(`\n✅ SFT per-primitive-v1 JSONL ready for training`);

  return { total: output.length, corpusRows: corpus.length - skipped, skipped };
}

// CLI
const args = process.argv.slice(2);
const corpusPath = args[0];
const labelsPath = args[1];
const outputPath = args[2] || "tools/evaluator-training/primitives/out/sft-per-primitive-v1.jsonl";

if (!corpusPath || !labelsPath) {
  console.log("Usage: node build-sft-per-primitive.mjs <corpus.jsonl> <labels.jsonl> [output.jsonl]");
  console.log("\nExample:");
  console.log(
    "  node build-sft-per-primitive.mjs data/evaluator-training/corpus.jsonl tools/evaluator-training/primitives/out/primitives-labels.jsonl"
  );
  process.exit(1);
}

await buildSFTPerPrimitive(corpusPath, labelsPath, outputPath);
