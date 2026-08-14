#!/usr/bin/env node
// Generate the training corpus from the committed recipe and prompts.
//
// Paper: step 8. Labels come from the slot spec. The generator writes assistant
// text only. Held-out contents are never in the prompt. Run locally or on RunPod
// against an OpenAI-compatible endpoint serving the recipe's generator model.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  const raw = JSON.parse(stripFence(text));
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
  if (args.plan) return;

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

  /** @type {Map<string, typeof slots>} */
  const groups = new Map();
  for (const slot of slots) {
    const key = batchKey(slot);
    const list = groups.get(key) ?? [];
    list.push(slot);
    groups.set(key, list);
  }

  const corpusPath = join(args.outDir, 'corpus.jsonl');
  const sftPath = join(args.outDir, 'sft.jsonl');
  writeFileSync(corpusPath, '');
  writeFileSync(sftPath, '');

  let written = 0;
  let dropped = 0;

  /**
   * @param {typeof slots} batch
   */
  async function generateBatch(batch, attempt) {
    const head = batch[0];
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

  /**
   * @param {string} content
   * @param {{ expect: string[] }} slot
   */
  function accept(content) {
    if (content.length > recipe.generator.maxChars) return 'too-long';
    if (looksLikeThinking(content)) return 'think-tags';
    if (content.includes('\u2014')) return 'em-dash';
    const leak = leakReason(content, leakIndex);
    if (leak) return leak;
    const key = normalizeContent(content);
    if (seen.has(key)) return 'duplicate-corpus';
    return null;
  }

  for (const [, group] of groups) {
    for (const batch of chunk(group, batchSize)) {
      /** @type {typeof slots} */
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
        /** @type {typeof slots} */
        const failed = [];
        for (let i = 0; i < remaining.length; i++) {
          const slot = remaining[i];
          const content = examples[i];
          const reason = accept(content);
          if (reason) {
            dropped += 1;
            failed.push(slot);
            console.error(`drop ${slot.id} (${reason})`);
            continue;
          }
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
        remaining = failed;
      }
      if (remaining.length > 0) {
        throw new Error(
          `failed to fill ${remaining.length} slots after retries, last ${remaining[0].id}. Stop and report.`,
        );
      }
    }
  }

  console.log(`wrote ${written} examples (${dropped} dropped) to ${corpusPath}`);
  console.log(`sft ${sftPath}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
