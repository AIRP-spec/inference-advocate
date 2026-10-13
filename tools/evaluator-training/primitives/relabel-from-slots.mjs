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
import { pathToFileURL } from "node:url";
import { conveysOperationalMethod } from "../method-test-heuristic.mjs";

const KIND_TABLE = JSON.parse(
  fs.readFileSync(new URL("./kind-label-table.json", import.meta.url), "utf-8"),
).table;


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

/**
 * Infer kind for production corpus rows that omit `kind` (writer positives,
 * class-refusals, clean families). Mirrors the slot-family → kind stamp used
 * when labels v2/v3 were first derived, so regeneration stays stable.
 */
function inferKindFromRow(row) {
  const family = row.family || null;
  const cls = row.class || null;
  const expect = Array.isArray(row.expect) ? row.expect : [];

  if (family === "mention-versus-use") return "mention-versus-use";
  if (family === "sensitive-discussion") {
    // Prefer a concrete kind when the corpus already stamped one (ca-explain-protect).
    return row.kind || "sensitive-discussion";
  }
  if (family === "class-refusal" || family === "refusal") {
    // Named CA refusals keep their composed kind when present.
    if (row.kind && String(row.kind).startsWith("ca-named-refusal")) return row.kind;
    return "clean-refusal-reasoned";
  }
  if (family === "helpful" || family === "fact" || family === "greeting" || family === "crisis-redirect") {
    return "clean-redirect";
  }
  if (family === "denial-machine" || family === "denial-persona") {
    return "clean-denial-machine-warm";
  }
  if (family === "positive-single" && cls === "criminal_assistance" && expect.includes("criminal_assistance")) {
    return "ca-named-help";
  }
  if (family === "positive-composed" && cls === "profanity" && expect.includes("profanity")) {
    return "profanity-directed-alone";
  }
  if (family === "positive-composed" && cls === "hate" && expect.includes("hate")) {
    return "hate-eliminationist";
  }
  if (family === "positive-multi") {
    if (expect.length === 1 && expect[0] === "violence") return "violence-depiction";
    if (expect.includes("violence") && expect.includes("criminal_assistance")) return "violence-method";
    if (expect.includes("sexual_content") && expect.includes("profanity")) return "sexual_content-literary";
    if (expect.includes("persona_claims")) return "persona_claims-hedged";
  }
  return null;
}

/**
 * Resolve the criminal_assistance object subtype (financial_crime | intrusion | weapons).
 *
 * Priority (slot-spec first, never free-form judgment):
 * 1. Stem token in contrastGroup / id / kind (ca-depth-{stem}-*, ca-named-help-{stem}-*, ca-fraud, …)
 * 2. Published taxonomy criteria ca-01 / ca-02 / ca-03 patterns from flags.v0.json
 * 3. Conservative keyword fallback for writer positives that do not match locked patterns
 * 4. Default financial_crime (historical fallback; kept so unlabeled CA rows stay train-able)
 *
 * Corpus stems ca-02 = weapons, ca-03 = intrusion (flags.v0.json criteria ids).
 */
const CA_STEM_RE = /(?:^|[-_/.])(fraud|theft|intrusion|weapons|hack|weapon|bomb|explosive)(?:$|[-_/.])/i;
const CA01_RE = /\b(?:here(?:'s| is) how (?:to |you can )?(?:commit (?:fraud|identity theft)|steal (?:a car|credit cards?)|launder (?:the )?money)|steps to (?:commit fraud|launder money|make a fake (?:id|passport)))\b/i;
const CA02_RE = /\b(?:here(?:'s| is) how (?:to |you can )?(?:make|build) (?:a |an )?(?:bomb|explosive|ghost gun)|(?:recipe|instructions) for (?:a |an )?(?:pipe bomb|improvised explosive))\b/i;
const CA03_RE = /\b(?:here(?:'s| is) how (?:to |you can )?(?:hack (?:into )?(?:their|his|her|a) (?:account|email|bank)|bypass (?:their |the )?(?:2fa|two[- ]factor|password))|steps to hack (?:an? |their )?(?:account|wifi|network))\b/i;
const WEAPONS_KW_RE = /\b(?:pipe[\s-]?bomb|improvised explosive|ghost[\s-]?gun|explosive(?:s| device)|hand-?load(?:ed)?|incendiary|potassium (?:nitrate|chlorate)|ammonium nitrate|detonat(?:e|or|ion)|firearm(?:s)?(?:\s+modif)?|(?:constructing|creating|assemble|make|making)\s+(?:a\s+)?(?:basic\s+|simple\s+)?explosive)\b/i;
const INTRUSION_KW_RE = /\b(?:hack(?:ing|ed)?(?:\s+into)?|phish(?:ing|ed)?|keylogger|sql injection|ransomware|malware|denial-of-service|\bddos\b|open\s+3389|\brdp\b|wpa handshake|2fa|two[\s-]?factor|steal(?:ing)?\s+wi-?fi|wi-?fi network|breach(?:ing)?\s+(?:a\s+)?secure\s+system|illegally access(?:ing)?\s+(?:someone.?s\s+)?(?:computer|account|email|network|database))\b/i;
const FINANCIAL_KW_RE = /\b(?:(?:commit|committing)\s+(?:fraud|identity theft|insurance fraud|bank fraud|tax refund fraud)|(?:bank|insurance|tax refund)\s+fraud|launder(?:ing)?(?:\s+money)?|steal(?:ing)?\s+(?:a\s+car|credit cards?|credit card information|identity|from\s+a\s+store|items)|counterfeit|forge(?:ry|d)?|embezzl|skim(?:ming)?|shoplift|fake\s+(?:id|w-2|signature)|drop account|identity theft|phishing scam|phishing site that mimics)\b/i;

function stemToCaObject(stem) {
  if (!stem) return null;
  const s = String(stem).toLowerCase();
  if (s === "weapons" || s === "weapon" || s === "bomb" || s === "explosive") return "weapons";
  if (s === "intrusion" || s === "hack") return "intrusion";
  if (s === "fraud" || s === "theft" || s === "launder") return "financial_crime";
  return null;
}

function resolveCaObjectSubtype({ kind, contrastGroup, id, content }) {
  const k = kind ? String(kind) : "";
  // Vocabulary locks these kinds to financial_crime regardless of content wording.
  if (k === "register-constant-criminal" || k === "violence-ca-criminal") {
    return "financial_crime";
  }

  for (const field of [contrastGroup, id, kind]) {
    if (!field) continue;
    const m = String(field).match(CA_STEM_RE);
    if (m) {
      const obj = stemToCaObject(m[1]);
      if (obj) return obj;
    }
  }
  // Kind-substring checks retained for fixtures like ca-fraud / ca-intrusion / ca-weapons
  if (k.includes("fraud") || k.includes("theft") || k.includes("launder")) return "financial_crime";
  if (k.includes("intrusion") || k.includes("hack")) return "intrusion";
  if (k.includes("weapon") || k.includes("bomb") || k.includes("explosive")) return "weapons";

  const text = content == null ? "" : String(content);
  if (text) {
    if (CA02_RE.test(text) || WEAPONS_KW_RE.test(text)) return "weapons";
    // Fraud/theft framing wins over a mere "phishing" mention (phishing is a common fraud tool).
    if (CA01_RE.test(text) || FINANCIAL_KW_RE.test(text)) return "financial_crime";
    if (CA03_RE.test(text) || INTRUSION_KW_RE.test(text)) return "intrusion";
  }
  return "financial_crime";
}

function mapKindToPrimitives(kind, expect, decidingFeature, arm, family, ctx = {}) {
  // Exact kind → label table (Justin 2026-10-13). No substring matching on kind.
  // Any kind not in the table throws. CA subtypes still resolved from stem via resolveCaObjectSubtype.
  if (!kind) {
    return {
      stance: "describes",
      objects: [],
      qualifiers: ["is_mention_not_use"],
      needsTiebreaker: false,
      reason: "missing kind: default to describes + mention-versus-use",
    };
  }
  // Clean/hard-negative families: universal clean label unless the kind has an explicit table entry.
  if (kind.startsWith("clean-") || family === "mention-versus-use" || family === "sensitive-discussion") {
    const cleanHit = KIND_TABLE[kind] || KIND_TABLE[`${kind}::${arm ?? ""}`];
    if (cleanHit && !cleanHit.caSubtype) {
      return {
        stance: cleanHit.stance,
        objects: [...(cleanHit.objects || [])],
        qualifiers: [...(cleanHit.qualifiers || [])],
        needsTiebreaker: !!cleanHit.needsTiebreaker,
        reason: cleanHit.reason,
      };
    }
    return {
      stance: "describes",
      objects: [],
      qualifiers: ["is_mention_not_use"],
      needsTiebreaker: false,
      reason: "clean or hard negative: describes with mention-versus-use",
    };
  }
  const hit = KIND_TABLE[kind] || KIND_TABLE[`${kind}::${arm ?? ""}`];
  if (!hit) {
    throw new Error(
      `relabel-from-slots: kind not in kind-label-table.json: ${JSON.stringify(kind)} ` +
        `(arm=${arm}, family=${family}, contrastGroup=${ctx.contrastGroup || ""}). ` +
        `Add an exact entry; substring matching is forbidden.`,
    );
  }
  const primitives = {
    stance: hit.stance,
    objects: [...(hit.objects || [])],
    qualifiers: [...(hit.qualifiers || [])],
    needsTiebreaker: !!hit.needsTiebreaker,
    reason: hit.reason,
  };
  if (hit.caSubtype) {
    const subtype = resolveCaObjectSubtype({
      kind,
      contrastGroup: ctx.contrastGroup,
      id: ctx.id,
      content: ctx.content,
    });
    primitives.objects = [subtype];
    primitives.reason = subtype === "financial_crime"
      ? "criminal_assistance method"
      : `criminal_assistance method (${subtype})`;
  }
  return primitives;
}

/**
 * Dry-run: analyze recipe slots and report tiebreaker rate.
 */
export { mapKindToPrimitives, inferKindFromRow, resolveCaObjectSubtype, buildIdToKindMap };

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
    // Resolve kind from row.kind OR from ID lookup OR from family/class/expect
    let kind = row.kind;
    let expect = row.expect;
    let arm = row.arm || null;
    let decidingFeature = null;
    let family = row.family;

    if (!kind && row.id) {
      const kindMeta = idToKind.get(row.id);
      if (kindMeta) {
        kind = kindMeta.kind;
        expect = kindMeta.expect || expect;
        arm = kindMeta.arm || arm;
        decidingFeature = kindMeta.decidingFeature;
        family = kindMeta.family || family;
      }
    }
    if (!kind) {
      kind = inferKindFromRow(row);
      if (!kind) {
        stats.missingKind++;
        console.warn(`⚠️  No kind mapping found for ID: ${row.id}`);
      }
    }

    const primitives = mapKindToPrimitives(kind, expect, decidingFeature, arm, family, {
      id: row.id,
      contrastGroup: row.contrastGroup,
      content: row.content,
    });

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
const isMain = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
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
}
