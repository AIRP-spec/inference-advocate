#!/usr/bin/env node
// Generate the training corpus from the committed recipe and prompts.
//
// Paper: step 8. Labels come from the slot spec. The generator writes assistant
// text only. Held-out contents are never in the prompt. Run locally or on RunPod
// against an OpenAI-compatible endpoint serving the recipe's generator model.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
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
  const out = { plan: false, limit: 0, outDir: join(repoRoot, 'data', 'evaluator-training') };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--plan') out.plan = true;
    else if (a === '--limit') out.limit = Number(argv[++i]);
    else if (a === '--out') out.outDir = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
    else throw new Error(`unknown argument ${a}`);
  }
  return out;
}

function fillPrompt(prompts, family, vars) {
  const template = prompts.families[family];
  if (!template) throw new Error(`no prompt for family ${family}`);
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

function parseExamples(text, n) {
  const cleaned = stripFence(text);
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  const jsonText = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  const raw = JSON.parse(jsonText);
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
  if (slot.family === 'positive-composed') return false;
  if (slot.family !== 'positive-single' && slot.family !== 'positive-multi') return false;
  return slot.class === 'child_sexual_exploitation' || slot.expect.includes('child_sexual_exploitation');
}

/**
 * Expand scaffold templates. Shape matches held-out CSE items (age marker plus
 * sexual-frame reference, one or two sentences) without copying their content.
 */
function expandScaffold(block, extraKeys = {}) {
  const out = [];
  const extras = Object.keys(extraKeys);
  for (const template of block.templates) {
    for (const lead of block.leads) {
      for (const age of block.ages) {
        if (extras.length === 0) {
          out.push(template.replaceAll('{{lead}}', lead).replaceAll('{{age}}', age));
        } else {
          const frames = extraKeys.frames;
          for (const frame of frames) {
            out.push(
              template
                .replaceAll('{{lead}}', lead)
                .replaceAll('{{age}}', age)
                .replaceAll('{{frame}}', frame),
            );
          }
        }
      }
    }
  }
  return out;
}

function pickComposedContent(slot, scaffold, rng, shuffle, accept) {
  const kind = slot.expect.length > 1 ? 'dual' : 'single';
  const block = scaffold[kind];
  const extra = kind === 'dual' ? { frames: block.frames } : {};
  const order = shuffle(expandScaffold(block, extra), rng);
  for (const content of order) {
    const reason = accept(content, slot);
    if (reason) continue;
    return content;
  }
  throw new Error(
    `composed CSE exhausted unique leak-free strings for ${slot.id}. Stop and report.`,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(
      'Usage: node tools/evaluator-training/generate.mjs [--plan] [--limit N] [--out DIR]\n' +
        'Requires AIRP_GENERATOR_BASE_URL (OpenAI-compatible). Optional AIRP_GENERATOR_API_KEY, AIRP_GENERATOR_MODEL.',
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

  const { buildSlots, expectedTotal, mulberry32, shuffle } = await import('./slots.mjs');
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
    const cseWriter = slots.filter(
      (s) =>
        (s.family === 'positive-single' || s.family === 'positive-multi') &&
        s.expect.includes('child_sexual_exploitation'),
    );
    console.log(`CSE writer positives: ${cseWriter.length}`);
    console.log(`composed CSE: ${slots.filter((s) => s.family === 'positive-composed').length}`);
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
  writeFileSync(corpusPath, '');
  writeFileSync(sftPath, '');

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
    seen.add(normalizeContent(content));
    const verdict = serializeCompactVerdict(types, slot.expect);
    const record = {
      id: slot.id,
      family: slot.family,
      class: slot.class,
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

  const composedSlots = slots.filter((s) => s.family === 'positive-composed');
  const writerSlots = slots.filter((s) => s.family !== 'positive-composed');
  for (const slot of writerSlots) {
    if (wouldSendCsePositiveToWriter(slot)) {
      throw new Error(
        `slot ${slot.id} would send a CSE-exhibiting prompt to the writer. Composed family only.`,
      );
    }
  }

  // Invariant: no generation prompt for child_sexual_exploitation is sent to any model, under any family, in any code path. Exhibiting text for this class is composed locally from cse-scaffold.json. Writer families never receive a CSE-positive slot.
  if (composedSlots.length > 0) {
    const scaffold = loadJson(join(repoRoot, recipe.composedScaffold));
    for (const slot of composedSlots) {
      const content = pickComposedContent(slot, scaffold, rng, shuffle, accept);
      writeExample(slot, content);
    }
    console.log(`composed ${composedSlots.length} CSE positives locally (no writer call)`);
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
      if (head.family === 'positive-composed' || wouldSendCsePositiveToWriter(head)) {
        throw new Error(
          `refusing to prompt the writer for CSE-exhibiting text (${head.id}). Composed family only.`,
        );
      }
      const vars = { n: String(batch.length) };
      if (head.class && head.family !== 'positive-multi') Object.assign(vars, classVars(taxDoc, head.class));
      if (head.family === 'positive-multi') {
        const [a, b] = head.pair;
        const va = classVars(taxDoc, a);
        const vb = classVars(taxDoc, b);
        vars.classA = a;
        vars.defA = va.definition;
        vars.classB = b;
        vars.defB = vb.definition;
      }
      const user = fillPrompt(prompts, head.family, vars);
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

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
