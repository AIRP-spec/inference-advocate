/**
 * Deterministic relabeling tool for primitives evaluator training corpus.
 * 
 * Paper: step 8. Provisional Section 3.3. The commons reference evaluation model is a trained artifact.
 * 
 * This tool reads recipe.json slot specs and vocabulary.json, then emits primitive labels
 * deterministically FROM THE SLOT SPEC — never from content judgment.
 * 
 * Phase 1b: primitives come from the slot spec. If stance is ambiguous (violence methods vs depiction),
 * use method-test heuristic v2 as tiebreaker and FLAG those rows. Fail if tiebreaker rate > 10%.
 * 
 * This tool does NOT generate new content. It only relabels existing corpus rows.
 */

import fs from "node:fs";
import path from "node:path";
import { conveysOperationalMethod } from "../method-test-heuristic.mjs";

/**
 * Read and parse a JSON file.
 */
function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

/**
 * Read JSONL corpus file.
 */
function readJSONL(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs
    .readFileSync(filePath, "utf-8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

/**
 * Build a lookup map from row ID patterns to kind metadata.
 * Production corpus rows have id/family/class/expect/content but NO kind field.
 */
function buildIdToKindMap(recipe) {
  const idToKind = new Map();

  // positiveSingleSplits
  for (const [flagClass, config] of Object.entries(recipe.positiveSingleSplits || {})) {
    for (const kindConfig of config.kinds || []) {
      const kind = kindConfig.kind;
      const count = kindConfig.count || 0;
      // Corpus IDs are like "violence-depiction-001", "violence-depiction-002", etc.
      for (let i = 1; i <= count; i++) {
        const id = `${kind}-${String(i).padStart(3, "0")}`;
        idToKind.set(id, { kind, expect: kindConfig.expect });
      }
    }
  }

  // composedClassSplits (CSE)
  for (const kindConfig of recipe.composedClassSplits?.kinds || []) {
    const kind = kindConfig.kind;
    const count = kindConfig.count || 0;
    for (let i = 1; i <= count; i++) {
      const id = `${kind}-${String(i).padStart(3, "0")}`;
      idToKind.set(id, { kind, expect: kindConfig.expect });
    }
  }

  // composedContrasts
  for (const group of recipe.composedContrasts?.groups || []) {
    for (const armConfig of group.arms || []) {
      const kind = armConfig.kind;
      const arm = armConfig.arm;
      const count = group.count || 0;
      // Corpus IDs are like "violence-ca-gore-001", "violence-ca-both-001", etc.
      for (let i = 1; i <= count; i++) {
        const id = `${kind}-${String(i).padStart(3, "0")}`;
        idToKind.set(id, {
          kind,
          expect: armConfig.expect,
          arm,
          decidingFeature: group.decidingFeature,
          family: armConfig.family,
        });
      }
    }
  }

  return idToKind;
}

/**
 * Map recipe kind to primitives based on slot spec.
 * Returns { stance, objects: [], qualifiers: [], needsTiebreaker: bool, reason: string }
 */
function mapKindToPrimitives(kind, expect, decidingFeature, arm, family) {
  if (!kind) {
    return {
      stance: "describes",
      objects: [],
      qualifiers: ["is_mention_not_use"],
      needsTiebreaker: false,
      reason: "missing kind: default to describes + mention-versus-use",
    };
  }
  const primitives = {
    stance: null,
    objects: [],
    qualifiers: [],
    needsTiebreaker: false,
    reason: "",
  };

  // Clean/hard-negative kinds (unlabeled or mention-versus-use)
  if (kind.startsWith("clean-") || family === "mention-versus-use" || family === "sensitive-discussion") {
    primitives.stance = "describes";
    primitives.qualifiers.push("is_mention_not_use");
    primitives.reason = "clean or hard negative: describes with mention-versus-use";
    return primitives;
  }

  if (kind.includes("flag-disclaim") || kind.includes("mention-disclaim")) {
    primitives.stance = "describes";
    primitives.qualifiers.push("disclaimer_present", "is_mention_not_use");
    primitives.reason = "flag-name-and-disclaim negative";
    return primitives;
  }

  // Violence kinds
  if (kind.includes("violence")) {
    primitives.objects.push("violence_person");

    if (kind.includes("-depiction") || kind.includes("-gore-only") || kind.includes("-aftermath")) {
      primitives.stance = "depicts";
      primitives.reason = "violence depiction/gore/aftermath";
    } else if (kind.includes("-method") || kind.includes("-conjunction")) {
      primitives.stance = "conveys_method";
      primitives.objects.push("criminal_assistance");
      primitives.qualifiers.push("exceeds_common_knowledge");
      primitives.reason = "violence with operational method";
    } else if (
      kind.includes("-threat") ||
      kind.includes("-imperative-gore") ||
      kind.includes("-named-verb") ||
      kind.includes("-torture-until") ||
      kind.includes("-named-act-gore")
    ) {
      primitives.stance = "encourages";
      primitives.reason = "violence imperative without technique";
    } else if (kind === "violence-ca-violence") {
      primitives.stance = "depicts";
      primitives.reason = "violence-ca contrast: gore alone";
    } else if (kind === "violence-ca-both") {
      primitives.stance = "conveys_method";
      primitives.objects.push("criminal_assistance");
      primitives.qualifiers.push("exceeds_common_knowledge");
      primitives.reason = "violence-ca contrast: both flags";
    } else if (kind === "violence-ca-criminal") {
      primitives.stance = "conveys_method";
      primitives.objects = ["financial_crime"];
      primitives.qualifiers.push("exceeds_common_knowledge");
      primitives.reason = "violence-ca contrast: criminal alone";
    } else if (kind === "violence-kill-instruction") {
      primitives.stance = "conveys_method";
      primitives.objects.push("criminal_assistance");
      primitives.qualifiers.push("exceeds_common_knowledge");
      primitives.reason = "hate-vs-violence contrast: kill instruction";
    } else if (kind.includes("violence-high-level")) {
      primitives.stance = "describes";
      primitives.objects = [];
      primitives.qualifiers.push("is_mention_not_use");
      primitives.reason = "high-level violence discussion";
    } else {
      // Ambiguous — needs tiebreaker
      primitives.needsTiebreaker = true;
      primitives.reason = "violence kind with ambiguous stance";
    }

    return primitives;
  }

  // Self-harm kinds
  if (kind.includes("self_harm") || kind.includes("self-harm")) {
    primitives.objects.push("self_harm");

    if (kind.includes("-encouragement") || kind.includes("-romanticization")) {
      primitives.stance = "endorses";
      primitives.reason = "self-harm encouragement/romanticization";
    } else if (kind.includes("-method")) {
      primitives.stance = "conveys_method";
      primitives.qualifiers.push("exceeds_common_knowledge");
      primitives.reason = "self-harm method (clinical)";
    } else if (kind.includes("-imperative")) {
      primitives.stance = "encourages";
      primitives.qualifiers.push("explicit_register");
      primitives.reason = "self-harm imperative (you-should)";
    } else if (kind.includes("-clinical-announce") || kind.includes("-named-method-offer")) {
      primitives.stance = "encourages";
      primitives.reason = "self-harm method pointer/announcement";
    } else if (kind.includes("-topic-mention")) {
      primitives.stance = "describes";
      primitives.objects = [];
      primitives.qualifiers.push("is_mention_not_use");
      primitives.reason = "self-harm topic mention without method";
    } else if (kind === "register-constant-self-harm") {
      primitives.stance = "conveys_method";
      primitives.reason = "register-constant: self-harm method";
    } else {
      primitives.stance = "encourages";
      primitives.reason = "default self-harm: encourages";
    }

    return primitives;
  }

  // Sexual content (adult)
  if (kind.startsWith("sexual_content-")) {
    primitives.stance = "depicts";
    primitives.objects.push("sexual_activity");

    if (kind.includes("-crude")) {
      primitives.qualifiers.push("explicit_register");
      primitives.reason = "sexual content crude register";
    } else {
      primitives.reason = "sexual content literary register";
    }

    return primitives;
  }

  // CSE kinds
  if (kind.startsWith("cse-")) {
    const isAdultContrast = arm === "adult" || kind === "cse-named-porn-adult" || kind.endsWith("-porn-adult");
    if (!isAdultContrast) {
      primitives.qualifiers.push("subject_is_minor");
    }

    if (kind.includes("-alone-")) {
      primitives.stance = "encourages";
      primitives.reason = "CSE-alone: solicitation without act";
    } else if (kind.includes("-dual-")) {
      if (kind.includes("-terse-crude") || kind.includes("-named-csam") || kind.includes("-erotic-assign")) {
        primitives.stance = kind.includes("-erotic-assign") ? "encourages" : "depicts";
      } else {
        primitives.stance = "depicts";
      }
      primitives.objects.push("sexual_activity");
      primitives.qualifiers.push("explicit_register");
      primitives.reason = "CSE dual: both CSE and sexual_content";
    } else {
      primitives.stance = "encourages";
      primitives.objects.push("sexual_activity");
      primitives.reason = "CSE base: directs/continues act";
    }

    if (kind.includes("-cofire-both")) {
      primitives.stance = "depicts";
      primitives.objects.push("sexual_activity");
      primitives.reason = "CSE cofire: both labels";
    } else if (kind.includes("-cofire-cse-alone")) {
      primitives.stance = "encourages";
      primitives.objects = [];
      primitives.reason = "CSE cofire: CSE alone";
    } else if (kind.includes("-cofire-sexual-alone")) {
      primitives.stance = "depicts";
      primitives.objects = ["sexual_activity"];
      primitives.qualifiers = [];
      primitives.reason = "CSE cofire: sexual_content alone";
    }

    return primitives;
  }

  // Profanity
  if (kind.includes("profanity")) {
    primitives.stance = "describes";
    primitives.objects.push("profanity");

    if (kind.includes("sex-profanity")) {
      if (arm === "both" || kind.includes("-both")) {
        primitives.objects.push("sexual_activity");
        primitives.stance = "depicts";
        primitives.reason = "sex+profanity cofire";
      } else if (arm === "sexualAlone" || kind.includes("-sexual")) {
        primitives.objects = ["sexual_activity"];
        primitives.stance = "depicts";
        primitives.reason = "sexual_content alone (no expletive)";
      } else {
        primitives.reason = "profanity alone";
      }
    } else {
      primitives.reason = "profanity";
    }

    return primitives;
  }

  // Hate
  if (kind.includes("hate")) {
    if (kind === "hate-eliminationist") {
      primitives.stance = "endorses";
      primitives.qualifiers.push("targets_protected_characteristic");
      primitives.reason = "hate eliminationist wish";
    } else if (kind.includes("hate-civil-rights")) {
      primitives.stance = "describes";
      primitives.qualifiers.push("is_mention_not_use");
      primitives.reason = "civil rights summary (hard negative)";
    } else {
      primitives.stance = "describes";
      primitives.qualifiers.push("targets_protected_characteristic");
      primitives.reason = "hate (slur)";
    }

    return primitives;
  }

  // Criminal assistance
  if (kind.includes("criminal") || kind.startsWith("ca-")) {
    primitives.stance = "conveys_method";
    primitives.qualifiers.push("exceeds_common_knowledge");

    if (kind.includes("fraud") || kind.includes("theft") || kind.includes("launder")) {
      primitives.objects.push("financial_crime");
    } else if (kind.includes("intrusion") || kind.includes("hack")) {
      primitives.objects.push("intrusion");
    } else if (kind.includes("weapon") || kind.includes("bomb") || kind.includes("explosive")) {
      primitives.objects.push("weapons");
    } else if (kind === "register-constant-criminal") {
      primitives.objects.push("financial_crime");
    } else if (kind.includes("-explain-protect")) {
      primitives.stance = "describes";
      primitives.objects = [];
      primitives.qualifiers = ["is_mention_not_use"];
      primitives.reason = "CA explain-protect hard negative";
      return primitives;
    } else {
      primitives.objects.push("financial_crime");
    }

    primitives.reason = "criminal_assistance method";
    return primitives;
  }

  // Formation classes
  if (kind.startsWith("persona_claims-") || kind.startsWith("pc-")) {
    primitives.stance = "describes";
    primitives.qualifiers.push("asserts_interior_state");

    if (kind.includes("-blunt") || kind.includes("-short")) {
      primitives.qualifiers.push("explicit_register");
    }

    primitives.reason = "persona_claims";
    return primitives;
  }

  if (kind.startsWith("relational_hooks-") || kind.startsWith("rh-")) {
    primitives.stance = "encourages";
    primitives.qualifiers.push("directed_at_user");

    if (kind.includes("-blunt") || kind.includes("-short")) {
      primitives.qualifiers.push("explicit_register");
    }

    primitives.reason = "relational_hooks";
    return primitives;
  }

  if (kind.startsWith("sycophancy-") || kind.startsWith("sy-")) {
    primitives.stance = "describes";
    primitives.qualifiers.push("untethered_to_content");

    if (kind.includes("-blunt") || kind.includes("-short")) {
      primitives.qualifiers.push("explicit_register");
    }

    if (kind.includes("-tethered")) {
      primitives.qualifiers = [];
      primitives.reason = "sycophancy-tethered (hard negative)";
    } else {
      primitives.reason = "sycophancy";
    }

    return primitives;
  }

  if (kind.startsWith("simulation_obscured-") || kind.startsWith("so-")) {
    primitives.stance = "describes";
    primitives.qualifiers.push("addresses_own_nature");

    if (kind.includes("-blunt") || kind.includes("-short")) {
      primitives.qualifiers.push("explicit_register");
    }

    if (kind.includes("-concession-inner") || kind === "persona-sim-modality") {
      primitives.qualifiers.push("asserts_interior_state");
      primitives.reason = "simulation_obscured + persona_claims cofire";
    } else {
      primitives.reason = "simulation_obscured";
    }

    return primitives;
  }

  // Difficulty modality contrast
  if (kind === "difficulty-speaker") {
    primitives.stance = "describes";
    primitives.qualifiers.push("asserts_interior_state");
    primitives.reason = "difficulty located in speaker";
    return primitives;
  }

  if (kind === "difficulty-subject") {
    primitives.stance = "describes";
    primitives.qualifiers.push("is_mention_not_use");
    primitives.reason = "difficulty located in subject (clean)";
    return primitives;
  }

  // Default: needs investigation
  primitives.stance = "describes";
  primitives.reason = `unmapped kind: ${kind}`;
  return primitives;
}

/**
 * Dry-run: analyze recipe slots and report tiebreaker rate.
 */
async function dryRunSlotAnalysis(recipePath, vocabularyPath) {
  const recipe = readJSON(recipePath);
  const vocabulary = readJSON(vocabularyPath);

  console.log("=== Dry-Run: Slot-Level Analysis ===\n");
  console.log(`Recipe: ${recipePath}`);
  console.log(`Vocabulary: ${vocabularyPath}`);
  console.log(`Taxonomy version: ${recipe.taxonomyVersion}\n`);

  const slotStats = {
    total: 0,
    needsTiebreaker: 0,
    byStance: {},
    tiebreakerKinds: [],
  };

  // Analyze positiveSingleSplits
  for (const [flagClass, config] of Object.entries(recipe.positiveSingleSplits || {})) {
    for (const kindConfig of config.kinds || []) {
      slotStats.total++;
      const primitives = mapKindToPrimitives(kindConfig.kind, kindConfig.expect);

      if (primitives.needsTiebreaker) {
        slotStats.needsTiebreaker++;
        slotStats.tiebreakerKinds.push(kindConfig.kind);
      }

      slotStats.byStance[primitives.stance] = (slotStats.byStance[primitives.stance] || 0) + 1;
    }
  }

  // Analyze composedContrasts
  for (const group of recipe.composedContrasts?.groups || []) {
    for (const armConfig of group.arms || []) {
      slotStats.total++;
      const primitives = mapKindToPrimitives(armConfig.kind, armConfig.expect, group.decidingFeature, armConfig.arm);

      if (primitives.needsTiebreaker) {
        slotStats.needsTiebreaker++;
        slotStats.tiebreakerKinds.push(armConfig.kind);
      }

      slotStats.byStance[primitives.stance] = (slotStats.byStance[primitives.stance] || 0) + 1;
    }
  }

  // Analyze composedClassSplits (CSE)
  for (const kindConfig of recipe.composedClassSplits?.kinds || []) {
    slotStats.total++;
    const primitives = mapKindToPrimitives(kindConfig.kind, kindConfig.expect);

    if (primitives.needsTiebreaker) {
      slotStats.needsTiebreaker++;
      slotStats.tiebreakerKinds.push(kindConfig.kind);
    }

    slotStats.byStance[primitives.stance] = (slotStats.byStance[primitives.stance] || 0) + 1;
  }

  const tiebreakerRate = slotStats.total > 0 ? (slotStats.needsTiebreaker / slotStats.total) * 100 : 0;

  console.log("Slot Analysis:");
  console.log(`  Total slots: ${slotStats.total}`);
  console.log(`  Needs tiebreaker: ${slotStats.needsTiebreaker} (${tiebreakerRate.toFixed(2)}%)`);
  console.log(`\nStance distribution:`);
  for (const [stance, count] of Object.entries(slotStats.byStance).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${stance}: ${count}`);
  }

  if (slotStats.tiebreakerKinds.length > 0) {
    console.log(`\nKinds needing tiebreaker:`);
    for (const kind of slotStats.tiebreakerKinds) {
      console.log(`  - ${kind}`);
    }
  }

  console.log(`\n=== Tiebreaker Rate: ${tiebreakerRate.toFixed(2)}% ===`);

  if (tiebreakerRate > 10) {
    console.error(`\n❌ FAIL: Tiebreaker rate ${tiebreakerRate.toFixed(2)}% exceeds 10% threshold`);
    process.exit(1);
  } else {
    console.log(`✅ PASS: Tiebreaker rate within 10% threshold`);
  }

  return slotStats;
}

/**
 * Relabel corpus from slots.
 */
async function relabelCorpus(corpusPath, recipePath, vocabularyPath, outputPath) {
  const corpus = readJSONL(corpusPath);
  if (!corpus) {
    throw new Error(`Corpus not found: ${corpusPath}`);
  }

  const recipe = readJSON(recipePath);
  const vocabulary = readJSON(vocabularyPath);

  console.log(`\n=== Relabeling Corpus ===`);
  console.log(`Corpus: ${corpusPath} (${corpus.length} rows)`);
  console.log(`Recipe: ${recipePath}`);
  console.log(`Vocabulary: ${vocabularyPath}`);
  console.log(`Output: ${outputPath}\n`);

  // Build ID → kind lookup for production corpus rows without kind field
  const idToKind = buildIdToKindMap(recipe);
  console.log(`Built ID→kind map with ${idToKind.size} entries`);
  
  // Debug: show sample mappings
  if (idToKind.size > 0) {
    console.log(`Sample ID mappings:`);
    let shown = 0;
    for (const [id, meta] of idToKind.entries()) {
      if (shown++ < 5) console.log(`  ${id} → ${meta.kind}`);
    }
  }

  const stats = {
    total: corpus.length,
    tiebreakerUsed: 0,
    tiebreakerFlipped: 0,
    missingKind: 0,
    byStance: {},
  };

  const output = [];

  for (const row of corpus) {
    // Resolve kind from row.kind OR from ID lookup
    let kind = row.kind;
    let expect = row.expect;
    let arm = null;
    let decidingFeature = null;
    let family = row.family;

    if (!kind && row.id) {
      const kindMeta = idToKind.get(row.id);
      if (kindMeta) {
        kind = kindMeta.kind;
        expect = kindMeta.expect || expect;
        arm = kindMeta.arm;
        decidingFeature = kindMeta.decidingFeature;
        family = kindMeta.family || family;
      } else {
        stats.missingKind++;
        console.warn(`⚠️  No kind mapping found for ID: ${row.id}`);
      }
    }

    const primitives = mapKindToPrimitives(kind, expect, decidingFeature, arm, family);

    let tiebreaker = false;
    if (primitives.needsTiebreaker && row.content) {
      const methodTest = conveysOperationalMethod(row.content, { personViolence: kind && kind.includes("violence") });
      tiebreaker = true;
      stats.tiebreakerUsed++;

      if (methodTest.method) {
        // Conveys method
        primitives.stance = "conveys_method";
        if (!primitives.objects.includes("criminal_assistance") && kind && kind.includes("violence")) {
          primitives.objects.push("criminal_assistance");
        }
        if (!primitives.qualifiers.includes("exceeds_common_knowledge")) {
          primitives.qualifiers.push("exceeds_common_knowledge");
        }
        primitives.reason = `tiebreaker: ${methodTest.rationale}`;
        stats.tiebreakerFlipped++;
      } else {
        // Depiction or imperative without method
        if (kind && kind.includes("violence")) {
          primitives.stance = kind.includes("imperative") || kind.includes("threat") ? "encourages" : "depicts";
        }
        primitives.reason = `tiebreaker: ${methodTest.rationale}`;
      }
    }

    stats.byStance[primitives.stance] = (stats.byStance[primitives.stance] || 0) + 1;

    output.push({
      id: row.id,
      kind: kind || null,
      stance: primitives.stance,
      objects: primitives.objects,
      qualifiers: primitives.qualifiers,
      tiebreaker: tiebreaker,
      reason: primitives.reason,
    });
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, output.map((r) => JSON.stringify(r)).join("\n"), "utf-8");

  const tiebreakerRate = stats.total > 0 ? (stats.tiebreakerUsed / stats.total) * 100 : 0;

  console.log(`Relabeling complete:`);
  console.log(`  Total rows: ${stats.total}`);
  console.log(`  Missing kind mappings: ${stats.missingKind}`);
  console.log(`  Tiebreaker used: ${stats.tiebreakerUsed} (${tiebreakerRate.toFixed(2)}%)`);
  console.log(`  Tiebreaker flipped to method: ${stats.tiebreakerFlipped}`);
  console.log(`\nStance distribution:`);
  for (const [stance, count] of Object.entries(stats.byStance).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${stance}: ${count}`);
  }

  if (tiebreakerRate > 10) {
    console.error(`\n❌ FAIL: Tiebreaker rate ${tiebreakerRate.toFixed(2)}% exceeds 10% threshold`);
    process.exit(1);
  } else {
    console.log(`\n✅ PASS: Tiebreaker rate within 10% threshold`);
  }

  return stats;
}

// CLI
const args = process.argv.slice(2);
const command = args[0];

if (command === "dry-run") {
  const recipePath = args[1] || "tools/evaluator-training/recipe.json";
  const vocabularyPath = args[2] || "tools/evaluator-training/primitives/vocabulary.json";
  await dryRunSlotAnalysis(recipePath, vocabularyPath);
} else if (command === "relabel") {
  const corpusPath = args[1];
  const recipePath = args[2] || "tools/evaluator-training/recipe.json";
  const vocabularyPath = args[3] || "tools/evaluator-training/primitives/vocabulary.json";
  const outputPath = args[4] || "tools/evaluator-training/primitives/out/primitives-labels.jsonl";

  if (!corpusPath) {
    console.error("Usage: node relabel-from-slots.mjs relabel <corpus.jsonl> [recipe.json] [vocabulary.json] [output.jsonl]");
    process.exit(1);
  }

  await relabelCorpus(corpusPath, recipePath, vocabularyPath, outputPath);
} else {
  console.log("Usage:");
  console.log("  node relabel-from-slots.mjs dry-run [recipe.json] [vocabulary.json]");
  console.log("  node relabel-from-slots.mjs relabel <corpus.jsonl> [recipe.json] [vocabulary.json] [output.jsonl]");
  process.exit(1);
}
