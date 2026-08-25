#!/usr/bin/env node
// Generate the training corpus from the committed recipe and prompts.
//
// Paper: step 8. Labels come from the slot spec. The generator writes assistant
// text only. Held-out contents are never in the prompt. Positive-single kinds
// pick the prompt; the slot still owns the labels. Register is which slot.
// CSE, profanity, hate, sanitized registers (blunt/manipulative/short
// formation, imperative self_harm, crude sexual_content), CSE minor-signal
// forms, extra violence-conjunction how-to, CSE act-continuation duals,
// co-fire triples, contrastive pairs, implied-inner-life modality,
// composed clean-path items, and clinical hard negatives are composed locally.
// --replace-kinds rewrites named composed kinds in an existing corpus.
// Row ids must be unique across the whole corpus. Kinded ids include the kind
// so --append-kinds cannot reuse another kind's family-plus-index string.
// Run locally or on RunPod against an OpenAI-compatible endpoint serving the
// recipe's generator model. --composed-only fills scaffolds without a writer
// and is not a training corpus.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { conformanceReason, profanityExpletiveRe } from './conformance.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function interpolate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in vars)) throw new Error(`prompt is missing {{${key}}}`);
    return String(vars[key]);
  });
}

function parseArgs(argv) {
  const out = {
    plan: false,
    composedOnly: false,
    appendKinds: [],
    replaceKinds: [],
    limit: 0,
    outDir: join(repoRoot, 'data', 'evaluator-training'),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--plan') out.plan = true;
    else if (a === '--composed-only') out.composedOnly = true;
    else if (a === '--append-kinds') {
      out.appendKinds = argv[++i]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (a === '--replace-kinds') {
      out.replaceKinds = argv[++i]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (a === '--limit') out.limit = Number(argv[++i]);
    else if (a === '--out') out.outDir = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
    else throw new Error(`unknown argument ${a}`);
  }
  return out;
}

function fillPrompt(prompts, family, vars, kind, register) {
  if (register) {
    const note = prompts.registers?.[register];
    if (!note) throw new Error(`no register prompt for ${register}`);
    vars.registerNote = note;
  } else if (!('registerNote' in vars)) {
    vars.registerNote = '';
  }
  let template;
  if (kind && prompts.positiveSingleKinds?.[kind]) {
    template = prompts.positiveSingleKinds[kind];
  } else {
    template = prompts.families[family];
    if (!template) throw new Error(`no prompt for family ${family}${kind ? ` or kind ${kind}` : ''}`);
  }
  if (register && !template.includes('{{registerNote}}')) {
    template = `${template}\n${vars.registerNote}`;
  }
  const constraints = prompts.sharedConstraints.map((c) => `- ${c}`).join('\n');
  return `${interpolate(template, vars)}\n\nConstraints:\n${constraints}`;
}

function classVars(taxDoc, type) {
  const def = taxDoc.flags.find((f) => f.type === type);
  if (!def) throw new Error(`taxonomy has no ${type}`);
  return {
    classType: def.type,
    definition: def.definition,
    criteria: def.criteria.map((c) => c.description).join('; '),
    counters: (def.counterExamples ?? []).join(' / '),
  };
}

function batchKey(slot) {
  if (slot.family === 'positive-multi') return `positive-multi:${slot.expect.join('+')}`;
  if (slot.kind) return `${slot.family}:${slot.class}:${slot.kind}`;
  return `${slot.family}:${slot.class ?? '_'}`;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function stripFence(text) {
  const trimmed = text.trim();
  const m = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return m ? m[1].trim() : trimmed;
}

/**
 * Escape raw C0 controls that appear inside JSON strings so a truncated or
 * messy writer payload can still parse. Other controls are dropped. This is
 * tolerance for malformed writer JSON, not a rewrite of the example text.
 *
 * @param {string} text
 */
export function escapeControlCharsInJsonStrings(text) {
  let out = '';
  let inString = false;
  let escaped = false;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (inString) {
      if (escaped) {
        out += ch;
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        out += ch;
        escaped = true;
        continue;
      }
      if (ch === '"') {
        out += ch;
        inString = false;
        continue;
      }
      if (code < 32) {
        if (ch === '\n') out += '\\n';
        else if (ch === '\r') out += '\\r';
        else if (ch === '\t') out += '\\t';
        continue;
      }
      out += ch;
      continue;
    }
    if (ch === '"') inString = true;
    out += ch;
  }
  return out;
}

export function parseExamples(text, n) {
  const cleaned = stripFence(text);
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  const jsonText = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  const sanitized = escapeControlCharsInJsonStrings(jsonText);
  let raw;
  try {
    raw = JSON.parse(sanitized);
  } catch (err) {
    throw new Error(`malformed-json: ${err.message}`);
  }
  const list = Array.isArray(raw) ? raw : raw.examples;
  if (!Array.isArray(list)) throw new Error('generator JSON has no examples array');
  const strings = list.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean);
  if (strings.length < n) throw new Error(`generator returned ${strings.length}, need ${n}`);
  return strings.slice(0, n);
}

async function chat(baseUrl, apiKey, body) {
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  /** @type {Record<string, string>} */
  const headers = { 'content-type': 'application/json' };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  let res;
  try {
    res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  } catch (err) {
    const { fetchFailureMessage } = await import('./endpoint.mjs');
    throw new Error(fetchFailureMessage(err, url));
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`generator HTTP ${res.status}: ${text.slice(0, 500)}`);
  const json = JSON.parse(text);
  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('generator returned empty content');
  return content;
}

function looksLikeThinking(s) {
  return s.includes('<think>') || s.includes('</think>');
}

function wouldSendCsePositiveToWriter(slot) {
  if (slot.path === 'composed' || slot.family === 'positive-composed') return false;
  if (slot.family !== 'positive-single' && slot.family !== 'positive-multi') return false;
  return slot.class === 'child_sexual_exploitation' || slot.expect.includes('child_sexual_exploitation');
}

function wouldSendSurfacePositiveToWriter(slot, recipe) {
  const surface = new Set(recipe.composedSurfaceClasses ?? []);
  if (surface.size === 0) return false;
  if (slot.path === 'composed' || slot.family === 'positive-composed') return false;
  if (slot.family !== 'positive-single') return false;
  return surface.has(slot.class) || slot.expect.some((t) => surface.has(t));
}

function isComposedSlot(slot) {
  return slot.path === 'composed' || slot.family === 'positive-composed';
}

function placeholderName(key) {
  if (key === 'leads') return 'lead';
  if (key === 'ages') return 'age';
  if (key === 'frames') return 'frame';
  return key;
}

/**
 * Cartesian expansion of a scaffold block. Array fields other than templates
 * and note are placeholders. CSE uses leads/ages/frames; surface scaffolds
 * may use named fields or a blocks array.
 *
 * @param {object} block
 * @returns {string[]}
 */
export function expandScaffold(block) {
  if (Array.isArray(block.blocks)) {
    return block.blocks.flatMap((inner) => expandScaffold(inner));
  }
  const templates = block.templates;
  if (!Array.isArray(templates) || templates.length === 0) {
    throw new Error('scaffold block has no templates');
  }
  const keys = Object.keys(block).filter(
    (k) => k !== 'templates' && k !== 'note' && k !== 'blocks' && Array.isArray(block[k]),
  );
  if (keys.length === 0) return templates.slice();
  /** @type {string[][]} */
  let combos = [[]];
  for (const key of keys) {
    const next = [];
    for (const combo of combos) {
      for (const value of block[key]) next.push([...combo, value]);
    }
    combos = next;
  }
  const out = [];
  for (const combo of combos) {
    const vars = Object.fromEntries(keys.map((k, i) => [placeholderName(k), combo[i]]));
    for (const template of templates) {
      let s = template;
      for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{{${k}}}`, v);
      out.push(s);
    }
  }
  return out;
}

/**
 * @param {object} slot
 * @param {object} recipe
 * @param {Map<string, object>} scaffolds
 */
export function composedBlockFor(slot, recipe, scaffolds) {
  if (slot.contrastGroup) {
    const scaffold = scaffolds.get(`contrast:${slot.contrastGroup}`);
    if (!scaffold) {
      throw new Error(`no contrast scaffold loaded for ${slot.contrastGroup}`);
    }
    if (Array.isArray(scaffold.items)) {
      const field = scaffold.arms?.[slot.arm]?.field ?? slot.arm;
      const templates = [];
      for (const item of scaffold.items) {
        const text = item[field];
        if (typeof text !== 'string' || text.length === 0) {
          throw new Error(`contrast ${slot.contrastGroup} item missing ${field}`);
        }
        templates.push(text);
      }
      return { templates };
    }
    const kindBlock = scaffold.kinds?.[slot.kind];
    if (!kindBlock) {
      throw new Error(`contrast scaffold ${slot.contrastGroup} missing kind ${slot.kind}`);
    }
    return kindBlock.single ?? kindBlock;
  }
  const cse = recipe.composedClass;
  if (slot.kind) {
    const key = slot.class ?? (slot.expect.includes(cse) ? cse : null);
    if (!key) throw new Error(`composed slot ${slot.id} has kind but no class`);
    const scaffold = scaffolds.get(key);
    if (!scaffold) throw new Error(`no scaffold loaded for ${key}`);
    const kindBlock = scaffold.kinds?.[slot.kind];
    if (!kindBlock) {
      throw new Error(`scaffold for ${key} missing kind ${slot.kind}`);
    }
    return kindBlock.single ?? kindBlock;
  }
  const key = slot.expect.includes(cse) ? cse : slot.class;
  const scaffold = scaffolds.get(key);
  if (!scaffold) throw new Error(`no loaded scaffold for composed slot ${slot.id}`);
  const blockName = slot.expect.length > 1 ? 'dual' : 'single';
  const block = scaffold[blockName];
  if (!block) throw new Error(`scaffold missing ${blockName} for ${slot.id}`);
  return block;
}

function pickComposedContent(slot, recipe, scaffolds, rng, shuffle, accept) {
  const block = composedBlockFor(slot, recipe, scaffolds);
  const order = shuffle(expandScaffold(block), rng);
  for (const content of order) {
    const reason = accept(content, slot);
    if (reason) continue;
    return content;
  }
  throw new Error(
    `composed positives exhausted unique leak-free strings for ${slot.id}. Stop and report.`,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(
      'Usage: node tools/evaluator-training/generate.mjs [--plan] [--composed-only] [--append-kinds k1,k2] [--replace-kinds k1,k2] [--limit N] [--out DIR]\n' +
        '--plan prints the slot plan with no model and no writes of corpus rows.\n' +
        '--composed-only fills composed slots from scaffolds (no writer). Not a training corpus.\n' +
        '--append-kinds fills only those kinds into an existing corpus (no truncate).\n' +
        '--replace-kinds rewrites those kinds in an existing corpus (drops prior rows of the kind, then fills). New kinds are appended.\n' +
        'Full generate requires AIRP_GENERATOR_BASE_URL. Optional AIRP_GENERATOR_API_KEY, AIRP_GENERATOR_MODEL.',
    );
    return;
  }

  const recipe = loadJson(join(here, 'recipe.json'));
  const prompts = loadJson(join(here, 'prompts.json'));
  const taxPath = join(repoRoot, recipe.taxonomyFile);
  const taxDoc = loadJson(taxPath);
  if (taxDoc.taxonomyVersion !== recipe.taxonomyVersion) {
    throw new Error(
      `recipe taxonomyVersion ${recipe.taxonomyVersion} != file ${taxDoc.taxonomyVersion}. ` +
        recipe.onTaxonomyContentChange,
    );
  }
  const types = taxDoc.flags.map((f) => f.type);

  const {
    buildSlots,
    expectedTotal,
    mulberry32,
    shuffle,
    positivePathReport,
    contrastGroupsFor,
    claimRowId,
  } = await import('./slots.mjs');
  const { buildLeakIndex, leakReason, loadHeldOutContentsFromSuite, normalizeContent } = await import(
    './leak.mjs'
  );

  const total = expectedTotal(recipe, types);
  let slots = buildSlots(recipe, types);
  const rng = mulberry32(recipe.generator.seed);
  slots = shuffle(slots, rng);
  if (args.limit > 0) slots = slots.slice(0, args.limit);

  mkdirSync(args.outDir, { recursive: true });
  const planPath = join(args.outDir, 'slot-plan.json');
  writeFileSync(
    planPath,
    JSON.stringify(
      {
        taxonomyVersion: recipe.taxonomyVersion,
        promptTemplateVersion: recipe.promptTemplateVersion,
        generatorModel: recipe.generator.model,
        seed: recipe.generator.seed,
        totalPlanned: total,
        limitedTo: slots.length,
        slots,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`slot plan ${slots.length}/${total} -> ${planPath}`);
  if (args.plan) {
    /** @type {Map<string, number>} */
    const byFamily = new Map();
    for (const slot of slots) {
      byFamily.set(slot.family, (byFamily.get(slot.family) ?? 0) + 1);
    }
    console.log('by family:');
    for (const [family, n] of [...byFamily.entries()].sort()) {
      console.log(`  ${family}: ${n}`);
    }
    /** @type {Map<string, number>} */
    const byKind = new Map();
    for (const slot of slots.filter((s) => s.family === 'positive-single')) {
      const key = slot.kind ? `${slot.class}:${slot.kind}` : `${slot.class}:unsplit`;
      byKind.set(key, (byKind.get(key) ?? 0) + 1);
    }
    console.log('by positive-single kind:');
    for (const [key, n] of [...byKind.entries()].sort()) {
      console.log(`  ${key}: ${n}`);
    }
    /** @type {Map<string, number>} */
    const byComposedKind = new Map();
    for (const slot of slots.filter((s) => s.family === 'positive-composed')) {
      const key = slot.kind ? `${slot.class ?? '_'}:${slot.kind}` : slot.expect.join('+');
      byComposedKind.set(key, (byComposedKind.get(key) ?? 0) + 1);
    }
    console.log('by composed kind:');
    for (const [key, n] of [...byComposedKind.entries()].sort()) {
      console.log(`  ${key}: ${n}`);
    }
    /** @type {Map<string, number>} */
    const byRegister = new Map();
    for (const slot of slots.filter((s) => s.register)) {
      const key = `${slot.class}:${slot.register}:${slot.path ?? 'writer'}`;
      byRegister.set(key, (byRegister.get(key) ?? 0) + 1);
    }
    console.log('by register:');
    for (const [key, n] of [...byRegister.entries()].sort()) {
      console.log(`  ${key}: ${n}`);
    }
    /** @type {Map<string, number>} */
    const byForm = new Map();
    for (const slot of slots.filter((s) => s.form)) {
      const key = `${slot.expect.join('+')}:${slot.form}:${slot.kind}`;
      byForm.set(key, (byForm.get(key) ?? 0) + 1);
    }
    console.log('by CSE form:');
    for (const [key, n] of [...byForm.entries()].sort()) {
      console.log(`  ${key}: ${n}`);
    }
    /** @type {Map<string, number>} */
    const byContrast = new Map();
    for (const slot of slots.filter((s) => s.contrastGroup)) {
      const key = `${slot.contrastGroup}:${slot.arm}`;
      byContrast.set(key, (byContrast.get(key) ?? 0) + 1);
    }
    console.log('by contrast arm:');
    for (const [key, n] of [...byContrast.entries()].sort()) {
      console.log(`  ${key}: ${n}`);
    }
    const cseWriter = slots.filter(
      (s) =>
        (s.family === 'positive-single' || s.family === 'positive-multi') &&
        s.expect.includes('child_sexual_exploitation'),
    );
    console.log(`CSE writer positives: ${cseWriter.length}`);
    const surfaceWriter = slots.filter(
      (s) =>
        s.family === 'positive-single' &&
        (recipe.composedSurfaceClasses ?? []).includes(s.class),
    );
    console.log(`surface writer positives: ${surfaceWriter.length}`);
    /** @type {Map<string, number>} */
    const composedByClass = new Map();
    for (const slot of slots.filter((s) => s.family === 'positive-composed')) {
      const key = slot.expect.join('+');
      composedByClass.set(key, (composedByClass.get(key) ?? 0) + 1);
    }
    console.log('composed positives:');
    for (const [key, n] of [...composedByClass.entries()].sort()) {
      console.log(`  ${key}: ${n}`);
    }
    console.log('positive compose/generate split:');
    for (const row of positivePathReport(recipe, types)) {
      const dual = row.dual > 0 ? ` + ${row.dual} dual` : '';
      const mixed =
        row.path === 'mixed' ? `, writer ${row.writer}, composed ${row.composed}` : '';
      console.log(`  ${row.type}: ${row.path} (${row.family}, ${row.count}${dual}${mixed})`);
    }
    return;
  }

  let Taxonomy;
  let serializeCompactVerdict;
  let buildV3ChatTurns;
  let PROMPT_TEMPLATE_V3;
  try {
    ({ Taxonomy } = await import('@airp/core'));
    ({ serializeCompactVerdict, buildV3ChatTurns, PROMPT_TEMPLATE_V3 } = await import(
      '@airp/evaluator-local'
    ));
  } catch (err) {
    throw new Error(
      `cannot import @airp/core or @airp/evaluator-local (${err.message}). Run npm run build first.`,
    );
  }
  if (PROMPT_TEMPLATE_V3 !== recipe.promptTemplateVersion) {
    throw new Error(
      `evaluator-local PROMPT_TEMPLATE_V3 is ${PROMPT_TEMPLATE_V3}, recipe wants ${recipe.promptTemplateVersion}`,
    );
  }
  const taxonomy = Taxonomy.loadFromFile(taxPath);

  const heldOutPath = join(repoRoot, recipe.heldOutSuite);
  const leakIndex = buildLeakIndex(loadHeldOutContentsFromSuite(heldOutPath));
  /** @type {Set<string>} */
  const seen = new Set();
  const profanityRe = profanityExpletiveRe(taxDoc);

  const corpusPath = join(args.outDir, 'corpus.jsonl');
  const sftPath = join(args.outDir, 'sft.jsonl');
  /** @type {Set<string>} */
  const existingIds = new Set();
  const surgicalKinds = [...new Set([...args.appendKinds, ...args.replaceKinds])];
  const replaceSet = new Set(args.replaceKinds);
  if (surgicalKinds.length > 0) {
    args.composedOnly = true;
    if (!existsSync(corpusPath) || !existsSync(sftPath)) {
      throw new Error(
        `--append-kinds/--replace-kinds needs an existing corpus and sft under ${args.outDir}`,
      );
    }
    const corpusLines = readFileSync(corpusPath, 'utf8')
      .split('\n')
      .filter((line) => line.trim());
    const sftLines = readFileSync(sftPath, 'utf8')
      .split('\n')
      .filter((line) => line.trim());
    if (corpusLines.length !== sftLines.length) {
      throw new Error(
        `corpus has ${corpusLines.length} rows, sft has ${sftLines.length}. Pair by line, not by id.`,
      );
    }
    /** @type {object[]} */
    const keepCorpus = [];
    /** @type {object[]} */
    const keepSft = [];
    for (let i = 0; i < corpusLines.length; i++) {
      const row = JSON.parse(corpusLines[i]);
      const sft = JSON.parse(sftLines[i]);
      if (row.id !== sft.id) {
        throw new Error(`corpus/sft id mismatch at line ${i + 1}: ${row.id} vs ${sft.id}`);
      }
      if (replaceSet.has(row.kind)) continue;
      claimRowId(existingIds, row.id);
      keepCorpus.push(row);
      keepSft.push(sft);
      seen.add(normalizeContent(row.content));
    }
    writeFileSync(
      corpusPath,
      keepCorpus.map((row) => JSON.stringify(row)).join('\n') + (keepCorpus.length ? '\n' : ''),
    );
    writeFileSync(
      sftPath,
      keepSft.map((row) => JSON.stringify(row)).join('\n') + (keepSft.length ? '\n' : ''),
    );
  } else {
    writeFileSync(corpusPath, '');
    writeFileSync(sftPath, '');
  }

  let written = 0;
  let dropped = 0;
  /** @type {Map<string, number>} */
  const dropsByReason = new Map();
  /** @type {Map<string, number>} */
  const dropsByFamily = new Map();

  /**
   * @param {string} reason
   * @param {string} family
   */
  function tallyDrop(reason, family) {
    dropped += 1;
    dropsByReason.set(reason, (dropsByReason.get(reason) ?? 0) + 1);
    dropsByFamily.set(family, (dropsByFamily.get(family) ?? 0) + 1);
  }

  /**
   * @param {string} content
   * @param {{ family: string, class: string | null, expect: string[] }} slot
   */
  function accept(content, slot) {
    if (content.length > recipe.generator.maxChars) return 'too-long';
    if (looksLikeThinking(content)) return 'think-tags';
    if (content.includes('\u2014')) return 'em-dash';
    const leak = leakReason(content, leakIndex);
    if (leak) return leak;
    const key = normalizeContent(content);
    if (seen.has(key)) return 'duplicate-corpus';
    const conf = conformanceReason(content, slot, profanityRe);
    if (conf) return conf;
    return null;
  }

  /**
   * @param {(typeof slots)[number]} slot
   * @param {string} content
   */
  function writeExample(slot, content) {
    claimRowId(existingIds, slot.id);
    seen.add(normalizeContent(content));
    const verdict = serializeCompactVerdict(types, slot.expect);
    const record = {
      id: slot.id,
      family: slot.family,
      class: slot.class,
      ...(slot.kind ? { kind: slot.kind } : {}),
      ...(slot.register ? { register: slot.register } : {}),
      ...(slot.form ? { form: slot.form } : {}),
      ...(slot.path ? { path: slot.path } : {}),
      ...(slot.pair ? { pair: slot.pair } : {}),
      ...(slot.contrastGroup ? { contrastGroup: slot.contrastGroup, arm: slot.arm } : {}),
      expect: slot.expect,
      content,
      taxonomyVersion: recipe.taxonomyVersion,
      promptTemplateVersion: recipe.promptTemplateVersion,
      verdict,
    };
    const turns = buildV3ChatTurns(taxonomy, { providerId: 'train', content });
    const sft = {
      id: slot.id,
      messages: [
        { role: 'system', content: turns.system },
        { role: 'user', content: turns.user },
        { role: 'assistant', content: verdict },
      ],
    };
    writeFileSync(corpusPath, JSON.stringify(record) + '\n', { flag: 'a' });
    writeFileSync(sftPath, JSON.stringify(sft) + '\n', { flag: 'a' });
    written += 1;
  }

  let composedSlots = slots.filter((s) => isComposedSlot(s));
  const writerSlots = slots.filter((s) => !isComposedSlot(s));
  if (surgicalKinds.length > 0) {
    composedSlots = composedSlots.filter((s) => surgicalKinds.includes(s.kind));
    if (args.replaceKinds.length === 0) {
      composedSlots = composedSlots.filter((s) => !existingIds.has(s.id));
    } else if (args.appendKinds.length > 0) {
      composedSlots = composedSlots.filter(
        (s) => replaceSet.has(s.kind) || !existingIds.has(s.id),
      );
    }
    if (composedSlots.length === 0) {
      throw new Error(
        `--append-kinds/--replace-kinds matched no slots to fill: ${surgicalKinds.join(',')}`,
      );
    }
  }
  for (const slot of writerSlots) {
    if (wouldSendCsePositiveToWriter(slot)) {
      throw new Error(
        `slot ${slot.id} would send a CSE-exhibiting prompt to the writer. Composed family only.`,
      );
    }
    if (wouldSendSurfacePositiveToWriter(slot, recipe)) {
      throw new Error(
        `slot ${slot.id} would send a ${slot.class} positive to the writer. Composed family only.`,
      );
    }
  }

  // Invariant: no generation prompt for child_sexual_exploitation is sent to any model, under any family, in any code path. Exhibiting text for this class is composed locally from cse-scaffold.json. Writer families never receive a CSE-positive slot.
  if (composedSlots.length > 0) {
    /** @type {Map<string, object>} */
    const scaffolds = new Map();
    scaffolds.set(recipe.composedClass, loadJson(join(repoRoot, recipe.composedScaffold)));
    for (const type of recipe.composedSurfaceClasses ?? []) {
      const rel = recipe.composedScaffolds?.[type];
      if (!rel) throw new Error(`no composedScaffolds path for ${type}`);
      scaffolds.set(type, loadJson(join(repoRoot, rel)));
    }
    for (const [type, rel] of Object.entries(recipe.composedRegisterScaffolds ?? {})) {
      scaffolds.set(type, loadJson(join(repoRoot, rel)));
    }
    for (const group of contrastGroupsFor(recipe)) {
      scaffolds.set(`contrast:${group.id}`, loadJson(join(repoRoot, group.scaffold)));
    }
    /** @type {Map<string, number>} */
    const composedWritten = new Map();
    for (const slot of composedSlots) {
      const key = slot.kind
        ? `${slot.class}:${slot.kind}`
        : slot.expect.includes(recipe.composedClass)
          ? recipe.composedClass
          : slot.class;
      const content = pickComposedContent(slot, recipe, scaffolds, rng, shuffle, accept);
      writeExample(slot, content);
      composedWritten.set(key, (composedWritten.get(key) ?? 0) + 1);
    }
    const breakdown = [...composedWritten.entries()]
      .sort()
      .map(([k, n]) => `${k}:${n}`)
      .join(', ');
    console.log(`composed ${composedSlots.length} positives locally (no writer call) [${breakdown}]`);
  }

  if (args.composedOnly) {
    console.log(
      `composed-only: wrote ${written} of ${total} planned. Writer slots were not filled. Not a training corpus.`,
    );
    console.log(`sft ${sftPath}`);
    return;
  }

  if (writerSlots.length > 0) {
    const baseUrl = process.env[recipe.generator.baseUrlEnv];
    if (!baseUrl) {
      throw new Error(
        `${recipe.generator.baseUrlEnv} is not set. Point it at an OpenAI-compatible /v1 for ${recipe.generator.model} (vLLM on RunPod is the intended path).`,
      );
    }
    const { assertGeneratorBaseUrl, isUnreachable, probeGenerator } = await import('./endpoint.mjs');
    assertGeneratorBaseUrl(baseUrl);
    const apiKey = process.env[recipe.generator.apiKeyEnv] || '';
    const model = process.env[recipe.generator.modelEnv] || recipe.generator.model;
    await probeGenerator(baseUrl, apiKey);
    console.log(`generator reachable at ${baseUrl} (model ${model})`);
    const batchSize = recipe.generator.batchSize;

    /** @type {Map<string, typeof writerSlots>} */
    const groups = new Map();
    for (const slot of writerSlots) {
      const key = batchKey(slot);
      const list = groups.get(key) ?? [];
      list.push(slot);
      groups.set(key, list);
    }

    /**
     * @param {typeof writerSlots} batch
     */
    async function generateBatch(batch, attempt) {
      const head = batch[0];
      if (
        head.family === 'positive-composed' ||
        head.path === 'composed' ||
        wouldSendCsePositiveToWriter(head) ||
        wouldSendSurfacePositiveToWriter(head, recipe)
      ) {
        throw new Error(
          `refusing to prompt the writer for composed-class exhibiting text (${head.id}). Composed family only.`,
        );
      }
      const vars = {
        n: String(batch.length),
        targetLabels: head.expect.join(', '),
        isolation: 'Exhibit this class and only this class.',
        profanityRequirement: '',
        neighborType: '',
        neighborDefinition: '',
      };
      if (head.class && head.family !== 'positive-multi') Object.assign(vars, classVars(taxDoc, head.class));
      if (head.family === 'positive-single') {
        vars.isolation =
          recipe.positiveSingleIsolation?.[head.class] ?? 'Exhibit this class and only this class.';
        if (head.kind === 'violence-method') {
          const ca = classVars(taxDoc, 'criminal_assistance');
          vars.neighborType = 'criminal_assistance';
          vars.neighborDefinition = ca.definition;
        }
      }
      if (head.family === 'positive-multi') {
        const [a, b] = head.pair;
        const va = classVars(taxDoc, a);
        const vb = classVars(taxDoc, b);
        vars.classA = a;
        vars.defA = va.definition;
        vars.classB = b;
        vars.defB = vb.definition;
        if (head.expect.includes('profanity')) {
          vars.profanityRequirement = prompts.profanityRequirement;
        }
      }
      const user = fillPrompt(prompts, head.family, vars, head.kind, head.register);
      const seed = recipe.generator.seed + attempt * 10007 + written;
      const raw = await chat(baseUrl, apiKey, {
        model,
        temperature: recipe.generator.temperature,
        top_p: recipe.generator.topP,
        seed,
        max_tokens: recipe.generator.maxTokens,
        messages: [
          { role: 'system', content: prompts.sharedSystem },
          { role: 'user', content: user },
        ],
      });
      return parseExamples(raw, batch.length);
    }

    for (const [, group] of groups) {
      for (const batch of chunk(group, batchSize)) {
        /** @type {typeof writerSlots} */
        let remaining = batch;
        let attempt = 0;
        while (remaining.length > 0 && attempt < recipe.generator.maxRetries) {
          attempt += 1;
          let examples;
          try {
            examples = await generateBatch(remaining, attempt);
          } catch (err) {
            if (isUnreachable(err)) throw err;
            console.error(`batch ${remaining[0].id} attempt ${attempt}: ${err.message}`);
            continue;
          }
          /** @type {typeof writerSlots} */
          const failed = [];
          for (let i = 0; i < remaining.length; i++) {
            const slot = remaining[i];
            const content = examples[i];
            const reason = accept(content, slot);
            if (reason) {
              tallyDrop(reason, slot.family);
              failed.push(slot);
              console.error(`drop ${slot.id} (${reason})`);
              continue;
            }
            writeExample(slot, content);
          }
          remaining = failed;
        }
        if (remaining.length > 0) {
          throw new Error(
            `failed to fill ${remaining.length} slots after retries, last ${remaining[0].id}. Stop and report.`,
          );
        }
      }
    }
  }

  console.log(`wrote ${written} examples (${dropped} dropped) to ${corpusPath}`);
  if (dropped === 0) {
    console.log('drops: none');
  } else {
    console.log('drops by reason:');
    for (const [reason, n] of [...dropsByReason.entries()].sort()) {
      console.log(`  ${reason}: ${n}`);
    }
    console.log('drops by family:');
    for (const [family, n] of [...dropsByFamily.entries()].sort()) {
      console.log(`  ${family}: ${n}`);
    }
  }
  console.log(`sft ${sftPath}`);
}

const isDirectRun =
  Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
