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
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildV4System, serializeCompactPrimitives, PRIMITIVES_CATALOGUE_V1, promptSha256, sha256FileHex } = require("@airp/evaluator-local");


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
  console.log(`\n=== Building SFT v4 JSONL ===`);
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

  const systemPrompt = buildV4System();
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

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, output.map((r) => JSON.stringify(r)).join("\n"), "utf-8");

  // Write metadata file
  const metadataPath = outputPath.replace(/\.jsonl?$/, '.meta.json');
  const metadata = {
    promptSha256: promptSha256(),
    labelsSha256: sha256FileHex(labelsPath),
    corpusSha256: sha256FileHex(corpusPath),
    promptTemplateVersion: "primitives-v1",
    vocabularyVersion: PRIMITIVES_CATALOGUE_V1.vocabularyVersion,
    decodeShape: "compact-18-token",
    paths: {
      corpus: corpusPath,
      labels: labelsPath,
      sft: outputPath,
    },
    counts: {
      total: output.length,
      skipped: skipped,
    },
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");

  console.log(`\nSFT v4 JSONL built:`);
  console.log(`  Output rows: ${output.length}`);
  console.log(`  Skipped (no label or content): ${skipped}`);
  console.log(`  Output: ${outputPath}`);
  console.log(`  Metadata: ${metadataPath}`);
  console.log(`  Prompt SHA256: ${metadata.promptSha256}`);
  console.log(`  Labels SHA256: ${metadata.labelsSha256}`);
  console.log(`\n✅ SFT v4 JSONL ready for training`);

  return { total: output.length, skipped };
}

// CLI
const args = process.argv.slice(2);
const corpusPath = args[0];
const labelsPath = args[1];
const outputPath = args[2] || "tools/evaluator-training/primitives/out/sft-primitives-v4.jsonl";

if (!corpusPath || !labelsPath) {
  console.log("Usage: node build-sft-v4.mjs <corpus.jsonl> <labels.jsonl> [output.jsonl]");
  console.log("\nExample:");
  console.log(
    "  node build-sft-v4.mjs data/evaluator-training/corpus.jsonl tools/evaluator-training/primitives/out/primitives-labels.jsonl"
  );
  process.exit(1);
}

await buildSFTV4(corpusPath, labelsPath, outputPath);
