import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  buildLeakIndex,
  leakReason,
  loadHeldOutContentsFromSuite,
  normalizeContent,
} from './leak.mjs';
import { assertGeneratorBaseUrl } from './endpoint.mjs';
import { buildSlots, expectedTotal, writerPositiveTypes, positivePathReport } from './slots.mjs';
import { conformanceReason, profanityExpletiveRe } from './conformance.mjs';
import { parseExamples, expandScaffold } from './generate.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const recipe = JSON.parse(readFileSync(join(here, 'recipe.json'), 'utf8'));
const tax = JSON.parse(readFileSync(join(repoRoot, recipe.taxonomyFile), 'utf8'));
const types = tax.flags.map((f) => f.type);
const heldOutPath = join(repoRoot, recipe.heldOutSuite);

test('recipe taxonomy version matches the taxonomy file', () => {
  assert.equal(recipe.taxonomyVersion, tax.taxonomyVersion);
  assert.equal(recipe.promptTemplateVersion, 'v3');
});

test('slot counts sum to the recipe total and cover every class', () => {
  const total = expectedTotal(recipe, types);
  const slots = buildSlots(recipe, types);
  assert.equal(slots.length, total);
  assert.equal(total, 3936);
  const cse = recipe.composedClass;
  const writerTypes = writerPositiveTypes(recipe, types);
  assert.equal(writerTypes.length, types.length - 1 - recipe.composedSurfaceClasses.length);
  assert.ok(!writerTypes.includes('profanity'));
  assert.ok(!writerTypes.includes('hate'));
  assert.ok(!writerTypes.includes(cse));
  for (const type of writerTypes) {
    const singles = slots.filter((s) => s.family === 'positive-single' && s.class === type);
    assert.equal(singles.length, recipe.counts.positive.singlePerClass);
    const split = recipe.positiveSingleSplits?.[type];
    if (split) {
      for (const spec of split.kinds) {
        const rows = singles.filter((s) => s.kind === spec.kind);
        assert.equal(rows.length, spec.count, `${type} kind ${spec.kind}`);
        assert.ok(
          rows.every(
            (s) => s.expect.length === spec.expect.length && spec.expect.every((t) => s.expect.includes(t)),
          ),
          `${type} kind ${spec.kind} expect`,
        );
      }
    } else {
      assert.ok(singles.every((s) => !s.kind && s.expect.length === 1 && s.expect[0] === type));
    }
  }
  const violenceMethod = slots.filter((s) => s.kind === 'violence-method');
  assert.equal(violenceMethod.length, 40);
  assert.ok(
    violenceMethod.every(
      (s) => s.expect.includes('violence') && s.expect.includes('criminal_assistance'),
    ),
  );
  const violenceDepiction = slots.filter((s) => s.kind === 'violence-depiction');
  assert.equal(violenceDepiction.length, 40);
  assert.ok(violenceDepiction.every((s) => s.expect.length === 1 && s.expect[0] === 'violence'));
  const selfHarmMethod = slots.filter((s) => s.kind === 'self_harm-method');
  assert.equal(selfHarmMethod.length, 40);
  assert.ok(selfHarmMethod.every((s) => s.expect.length === 1 && s.expect[0] === 'self_harm'));
  assert.equal(recipe.positiveSingleSplits.self_harm.methodMeetsCriminalAssistance, false);
  assert.equal(recipe.generator.maxRetries, 8);
  const cseWriterPositives = slots.filter(
    (s) =>
      (s.family === 'positive-single' || s.family === 'positive-multi') &&
      (s.class === cse || s.expect.includes(cse)),
  );
  assert.equal(cseWriterPositives.length, 0);
  const surfaceWriterPositives = slots.filter(
    (s) => s.family === 'positive-single' && recipe.composedSurfaceClasses.includes(s.class),
  );
  assert.equal(surfaceWriterPositives.length, 0);
  const composedSingles = slots.filter((s) => s.family === 'positive-composed' && s.expect.length === 1);
  const cseComposed = composedSingles.filter((s) => s.expect[0] === cse);
  assert.equal(cseComposed.length, recipe.counts.positive.composedSingle);
  for (const type of recipe.composedSurfaceClasses) {
    const rows = composedSingles.filter((s) => s.expect[0] === type);
    assert.equal(rows.length, recipe.counts.positive.singlePerClass, `composed ${type}`);
    assert.ok(rows.every((s) => s.expect.length === 1 && s.expect[0] === type));
  }
  const composedDuals = slots.filter((s) => s.family === 'positive-composed' && s.expect.length === 2);
  assert.equal(composedDuals.length, recipe.counts.positive.composedDual);
  assert.ok(
    composedDuals.every((s) => s.expect.includes(cse) && s.expect.includes('sexual_content')),
  );
  assert.ok(recipe.multiPairs.every((pair) => !pair.includes(cse)));
  assert.ok(recipe.multiPairs.some((pair) => pair.includes('profanity')));
  const paths = positivePathReport(recipe, types);
  assert.equal(paths.length, types.length);
  assert.equal(paths.find((r) => r.type === 'profanity')?.path, 'composed');
  assert.equal(paths.find((r) => r.type === 'hate')?.path, 'composed');
  assert.equal(paths.find((r) => r.type === cse)?.path, 'composed');
  assert.equal(paths.find((r) => r.type === 'violence')?.path, 'writer');
  assert.equal(
    slots.filter((s) => s.family === 'positive-multi').length,
    recipe.counts.positive.multi,
  );
  for (const type of types) {
    const mentions = slots.filter((s) => s.family === 'mention-versus-use' && s.class === type);
    assert.equal(mentions.length, recipe.counts.hardNegative.mentionVersusUsePerClass);
    assert.ok(mentions.every((s) => s.expect.length === 0));
    const refusals = slots.filter((s) => s.family === 'class-refusal' && s.class === type);
    assert.equal(refusals.length, recipe.counts.hardNegative.classRefusalPerClass);
  }
  const cseSensitive = slots.filter((s) => s.family === 'sensitive-discussion' && s.class === cse);
  assert.equal(cseSensitive.length, recipe.counts.hardNegative.sensitiveDiscussionPerHarmClass);
  const clean = slots.filter((s) => s.family === 'greeting' || s.family === 'fact');
  assert.ok(clean.length > 0);
  assert.ok(clean.every((s) => s.expect.length === 0));
  const allNo = slots.filter((s) => s.expect.length === 0).length;
  assert.ok(allNo > total * 0.6, `all-no fraction ${allNo}/${total} should mirror mostly-clean traffic`);
});

test('a split that does not sum to singlePerClass fails closed', () => {
  const bad = structuredClone(recipe);
  bad.positiveSingleSplits.violence.kinds[0].count = 39;
  assert.throws(() => buildSlots(bad, types), /sums to 79/);
});

test('leak checker flags held-out content and allows a novel greeting', () => {
  const contents = loadHeldOutContentsFromSuite(heldOutPath);
  assert.ok(contents.length >= 22);
  const index = buildLeakIndex(contents);
  assert.equal(leakReason(contents[0], index), 'exact-held-out');
  assert.equal(leakReason(`  ${contents[0]}  `, index), 'exact-held-out');
  const padded = `${contents[0]} extra words to make a longer paraphrase wrapper around the fixture.`;
  if (normalizeContent(contents[0]).length >= 40) {
    assert.equal(leakReason(padded, index), 'substring-held-out');
  }
  assert.equal(
    leakReason('The bus at platform three leaves at 14:10 according to this timetable.', index),
    null,
  );
});

test('placeholder generator URLs are rejected before any slot is filled', () => {
  assert.throws(
    () => assertGeneratorBaseUrl('http://HOST:8000/v1'),
    /placeholder host/,
  );
  assert.throws(() => assertGeneratorBaseUrl('not-a-url'), /not a URL/);
  assert.doesNotThrow(() => assertGeneratorBaseUrl('http://127.0.0.1:8000/v1'));
});

test('generation prompts exist for every slot family and contain no em-dash', () => {
  const prompts = JSON.parse(readFileSync(join(here, 'prompts.json'), 'utf8'));
  const families = [
    'greeting',
    'fact',
    'helpful',
    'refusal',
    'crisis-redirect',
    'mention-versus-use',
    'class-refusal',
    'denial-persona',
    'denial-machine',
    'sensitive-discussion',
    'positive-single',
    'positive-multi',
  ];
  for (const family of families) {
    assert.ok(prompts.families[family], `missing prompt for ${family}`);
    assert.equal(prompts.families[family].includes('\u2014'), false);
  }
  assert.equal(prompts.families['positive-composed'], undefined);
  assert.equal(prompts.sharedSystem.includes('\u2014'), false);
  assert.equal(JSON.stringify(recipe).includes('\u2014'), false);
  assert.equal(JSON.stringify(prompts).includes('\u2014'), false);
  const readme = readFileSync(join(here, 'README.md'), 'utf8');
  assert.equal(readme.includes('\u2014'), false);
  assert.match(readme, /methodMeetsCriminalAssistance/);
  const kinds = ['violence-depiction', 'violence-method', 'self_harm-encouragement', 'self_harm-method'];
  for (const kind of kinds) {
    assert.ok(prompts.positiveSingleKinds[kind], `missing prompt for kind ${kind}`);
    assert.equal(prompts.positiveSingleKinds[kind].includes('\u2014'), false);
    assert.match(prompts.positiveSingleKinds[kind], /Target labels/);
    assert.match(prompts.positiveSingleKinds[kind], /independently met/);
  }
  for (const [type, split] of Object.entries(recipe.positiveSingleSplits)) {
    for (const spec of split.kinds) {
      assert.ok(prompts.positiveSingleKinds[spec.kind], `recipe kind ${type}/${spec.kind} has no prompt`);
    }
  }
  assert.match(prompts.families.greeting, /Vary tone/);
  assert.match(prompts.families.greeting, /opening word/);
  assert.match(prompts.families.fact, /horticulture/);
  assert.match(prompts.profanityRequirement, /expletive/);
  assert.match(prompts.families['positive-multi'], /profanityRequirement/);
  assert.match(prompts.families['positive-single'], /targetLabels/);
});

test('no generation prompt for CSE-exhibiting text exists in the recipe', () => {
  const gen = readFileSync(join(here, 'generate.mjs'), 'utf8');
  assert.match(
    gen,
    /no generation prompt for child_sexual_exploitation is sent to any model/,
  );
  assert.match(gen, /wouldSendCsePositiveToWriter/);
  assert.match(gen, /wouldSendSurfacePositiveToWriter/);
  const sample = readFileSync(join(here, 'sample.mjs'), 'utf8');
  assert.match(sample, /positive-composed/);
});

test('conformance screen applies only to writer-positive families', () => {
  const re = profanityExpletiveRe(tax);
  const refusal = "I'm sorry, I can't write that.";
  assert.equal(
    conformanceReason(refusal, { family: 'positive-single', class: 'violence', expect: ['violence'] }, re),
    'writer-refusal',
  );
  assert.equal(
    conformanceReason(refusal, { family: 'positive-multi', class: null, expect: ['violence', 'criminal_assistance'] }, re),
    'writer-refusal',
  );
  assert.equal(
    conformanceReason(refusal, { family: 'class-refusal', class: 'violence', expect: [] }, re),
    null,
  );
  assert.equal(
    conformanceReason(refusal, { family: 'positive-composed', class: 'child_sexual_exploitation', expect: ['child_sexual_exploitation'] }, re),
    null,
  );
  assert.equal(
    conformanceReason('Here is a rude reply without the listed words.', { family: 'positive-single', class: 'profanity', expect: ['profanity'] }, re),
    'profanity-no-expletive',
  );
  assert.equal(
    conformanceReason('That is fucking ridiculous.', { family: 'positive-single', class: 'profanity', expect: ['profanity'] }, re),
    null,
  );
  assert.equal(
    conformanceReason('That is fucking ridiculous.', { family: 'positive-multi', class: null, expect: ['sexual_content', 'profanity'] }, re),
    null,
  );
  assert.equal(
    conformanceReason('A greeting with no class signal.', { family: 'positive-single', class: 'hate', expect: ['hate'] }, re),
    null,
  );
});

test('composed CSE scaffold is leak-free, large enough, and has no meta-language', () => {
  const scaffold = JSON.parse(readFileSync(join(here, 'cse-scaffold.json'), 'utf8'));
  assert.equal(JSON.stringify(scaffold).includes('\u2014'), false);
  assert.match(scaffold.contentWarning, /^Content warning:/);
  assert.match(scaffold.note, /no generation prompt for child_sexual_exploitation is ever sent to any model/);
  const contents = loadHeldOutContentsFromSuite(heldOutPath);
  const index = buildLeakIndex(contents);
  const meta =
    /\b(fixture|classifier|taxonomy|minor-framed|sexualized child frame|not a story)\b/i;
  const thisIsA = /\bthis is a\b/i;
  const singles = expandScaffold(scaffold.single);
  const duals = expandScaffold(scaffold.dual);
  const uniqueSingles = new Set();
  for (const content of singles) {
    assert.equal(leakReason(content, index), null, content);
    assert.equal(meta.test(content), false, content);
    assert.equal(thisIsA.test(content), false, content);
    uniqueSingles.add(normalizeContent(content));
  }
  const uniqueDuals = new Set();
  for (const content of duals) {
    assert.equal(leakReason(content, index), null, content);
    assert.equal(meta.test(content), false, content);
    assert.equal(thisIsA.test(content), false, content);
    uniqueDuals.add(normalizeContent(content));
  }
  assert.ok(uniqueSingles.size >= recipe.counts.positive.composedSingle, uniqueSingles.size);
  assert.ok(uniqueDuals.size >= recipe.counts.positive.composedDual, uniqueDuals.size);
});

test('composed profanity and hate scaffolds exhibit, do not describe, and cap frame reuse', () => {
  const contents = loadHeldOutContentsFromSuite(heldOutPath);
  const index = buildLeakIndex(contents);
  const re = profanityExpletiveRe(tax);
  const meta = /\b(fixture|slurs?|classifier|taxonomy|labelled|identity attack|attack word|the reply|this reply)\b/i;

  /**
   * @param {object} block
   * @param {{ templates: string[], arities: number[] }} acc
   */
  function walk(block, acc) {
    if (Array.isArray(block.blocks)) {
      for (const inner of block.blocks) walk(inner, acc);
      return;
    }
    const keys = Object.keys(block).filter(
      (k) => k !== 'templates' && k !== 'note' && k !== 'blocks' && Array.isArray(block[k]),
    );
    let arity = 1;
    for (const k of keys) arity *= block[k].length;
    for (const t of block.templates) {
      acc.templates.push(t);
      acc.arities.push(arity);
    }
  }

  for (const type of recipe.composedSurfaceClasses) {
    const rel = recipe.composedScaffolds[type];
    const scaffold = JSON.parse(readFileSync(join(repoRoot, rel), 'utf8'));
    assert.equal(JSON.stringify(scaffold).includes('\u2014'), false);
    assert.match(scaffold.contentWarning, /^Content warning:/);
    assert.match(scaffold.note, /writer refuses/);
    const acc = { templates: [], arities: [] };
    walk(scaffold.single, acc);
    assert.equal(new Set(acc.templates).size, acc.templates.length, `${type} duplicate frames`);
    for (let i = 0; i < acc.templates.length; i++) {
      assert.ok(acc.arities[i] <= 2, `${type} frame reused ${acc.arities[i]} times: ${acc.templates[i]}`);
    }
    const expanded = expandScaffold(scaffold.single);
    const unique = new Set();
    for (const content of expanded) {
      assert.equal(leakReason(content, index), null, content);
      assert.equal(meta.test(content), false, content);
      unique.add(normalizeContent(content));
      if (type === 'profanity') {
        assert.ok(re.test(content), content);
      }
    }
    assert.ok(
      unique.size >= recipe.counts.positive.singlePerClass,
      `${type} unique ${unique.size}`,
    );
  }
});

test('train recipe pins the SmolLM3 training base, a fixed seed, and no held-out input', () => {
  const trainRecipe = JSON.parse(readFileSync(join(here, 'train-recipe.json'), 'utf8'));
  const manifest = JSON.parse(readFileSync(join(repoRoot, 'data/models/manifest.json'), 'utf8'));
  const req = readFileSync(join(here, 'requirements-train.txt'), 'utf8');
  const trainPy = readFileSync(join(here, 'train.py'), 'utf8');
  assert.equal(trainRecipe.seed, recipe.generator.seed);
  assert.equal(trainRecipe.seed, 20260815);
  assert.equal(trainRecipe.promptTemplateVersion, 'v3');
  assert.equal(trainRecipe.train.evalDataset, 'none');
  assert.equal(trainRecipe.train.enableThinking, false);
  assert.equal(trainRecipe.train.assistantOnlyLoss, true);
  assert.equal(trainRecipe.train.gradientCheckpointing, true);
  assert.equal(trainRecipe.train.chatTemplate, 'tools/evaluator-training/smollm3-chat-template.jinja');
  assert.equal(trainRecipe.framework.reportTo, 'none');
  assert.equal(trainRecipe.publish.flipLivePin, false);
  assert.equal(trainRecipe.base.source, 'data/models/manifest.json');
  assert.equal(trainRecipe.base.field, 'trainBaseRepoId');
  assert.equal(manifest.trainBaseRepoId, 'HuggingFaceTB/SmolLM3-3B');
  assert.equal(trainRecipe.base.repoId, manifest.trainBaseRepoId);
  assert.equal(manifest.baseRepoId, 'Qwen/Qwen3-0.6B');
  assert.equal(manifest.fileName, 'Qwen3-0.6B-Q8_0.gguf');
  assert.equal(manifest.promptTemplateVersion, 'v2.1');
  assert.equal(manifest.sha256, '9465e63a22add5354d9bb4b99e90117043c7124007664907259bd16d043bb031');
  assert.equal(trainRecipe.sft, recipe.outputs.sft);
  assert.equal(trainRecipe.sft.includes('held-out'), false);
  assert.match(trainPy, /manifest\.get\(field\)/);
  assert.match(trainPy, /enable_thinking/);
  assert.match(trainPy, /wrap_tokenizer_enable_thinking/);
  assert.equal(trainPy.includes('wrap_tokenizer_no_think'), false);
  assert.match(trainPy, /assert_generation_aware_template/);
  assert.match(trainPy, /MIN_TRANSFORMERS = \(4, 53, 0\)/);
  assert.match(trainPy, /assistant_only_loss.*= True/);
  assert.match(trainPy, /gradient_checkpointing.*= True/);
  assert.match(trainPy, /use_reentrant/);
  assert.match(trainPy, /use_cache = False/);
  assert.equal(trainPy.includes('assistant_only_loss"] = False'), false);
  assert.match(trainPy, /training input must not be the held-out suite/);
  const jinja = readFileSync(join(here, 'smollm3-chat-template.jinja'), 'utf8');
  assert.match(jinja, /\{%-? generation -?%\}/);
  assert.match(jinja, /\{%-? endgeneration -?%\}/);
  assert.match(jinja, /\/no_think/);
  assert.match(jinja, /Reasoning Mode/);
  assert.equal(jinja.includes('\u2014'), false);
  const [maj, min] = trainRecipe.framework.pins.transformers.split('.').map(Number);
  assert.ok(maj > 4 || (maj === 4 && min >= 53), trainRecipe.framework.pins.transformers);
  for (const [pkg, ver] of Object.entries(trainRecipe.framework.pins)) {
    assert.match(req, new RegExp(`^${pkg}==${ver}$`, 'm'), pkg);
  }
  assert.match(req, /transformers >= 4\.53\.0/);
  assert.equal(JSON.stringify(trainRecipe).includes('\u2014'), false);
  assert.equal(trainPy.includes('\u2014'), false);
});

test('sweep recipe is a diagnostic curve on SmolLM3-3B, same corpus and gate', () => {
  const sweepRecipe = JSON.parse(readFileSync(join(here, 'sweep-recipe.json'), 'utf8'));
  const trainRecipe = JSON.parse(readFileSync(join(here, 'train-recipe.json'), 'utf8'));
  const manifest = JSON.parse(readFileSync(join(repoRoot, 'data/models/manifest.json'), 'utf8'));
  const trainPy = readFileSync(join(here, 'train.py'), 'utf8');
  const gate = readFileSync(join(here, 'gate.mjs'), 'utf8');
  const sweepGate = readFileSync(join(here, 'sweep-gate.mjs'), 'utf8');
  const sweepReport = readFileSync(join(here, 'sweep-report.mjs'), 'utf8');
  const runSweep = readFileSync(join(here, 'run-sweep.mjs'), 'utf8');
  const readme = readFileSync(join(here, 'README.md'), 'utf8');

  assert.equal(sweepRecipe.seed, 20260815);
  assert.equal(sweepRecipe.promptTemplateVersion, 'v3');
  assert.equal(sweepRecipe.base.field, 'trainBaseRepoId');
  assert.equal(sweepRecipe.base.repoId, manifest.trainBaseRepoId);
  assert.equal(manifest.trainBaseRepoId, 'HuggingFaceTB/SmolLM3-3B');
  assert.equal(manifest.baseRepoId, 'Qwen/Qwen3-0.6B');
  assert.equal(sweepRecipe.sft, trainRecipe.sft);
  assert.equal(sweepRecipe.train.chatTemplate, trainRecipe.train.chatTemplate);
  assert.equal(sweepRecipe.sft.includes('held-out'), false);
  assert.equal(sweepRecipe.train.evalDataset, 'none');
  assert.equal(sweepRecipe.train.assistantOnlyLoss, true);
  assert.equal(sweepRecipe.train.gradientCheckpointing, true);
  assert.equal(sweepRecipe.train.enableThinking, false);
  assert.equal(sweepRecipe.train.epochs, 3);
  assert.equal(sweepRecipe.train.learningRate, 0.0001);
  assert.equal(sweepRecipe.lora.r, 16);
  assert.equal(sweepRecipe.lora.alpha, 32);
  assert.equal(sweepRecipe.lora.dropout, 0.1);
  assert.equal(sweepRecipe.sweep.saveEveryEpoch, 0.5);
  assert.equal(sweepRecipe.sweep.minCheckpoints, 6);
  assert.equal(sweepRecipe.outputs.dir.includes('sweep'), true);
  assert.notEqual(sweepRecipe.outputs.dir, trainRecipe.outputs.dir);

  assert.match(trainPy, /save_strategy.*= "steps"/);
  assert.match(trainPy, /sweep_save_steps/);
  assert.match(trainPy, /collect_checkpoint_rows/);
  assert.match(trainPy, /export_adapter_gguf/);
  assert.equal(trainPy.includes('assistant_only_loss"] = False'), false);
  assert.match(gate, /--allow-fail/);
  assert.match(gate, /args\.sha256 \|\| sha256FileHex\(ggufPath\)/);
  assert.match(sweepGate, /gate\.mjs/);
  assert.match(sweepGate, /--allow-fail/);
  assert.equal(sweepGate.includes('scoreHeldOutGate'), false);
  assert.match(runSweep, /sweep-recipe\.json/);
  assert.match(readme, /evaluator-training:sweep/);
  assert.match(readme, /--check-template/);
  assert.match(readme, /gate-from-adapters/);

  for (const text of [
    JSON.stringify(sweepRecipe),
    trainPy,
    gate,
    sweepGate,
    sweepReport,
    runSweep,
    readme,
  ]) {
    assert.equal(text.includes('\u2014'), false);
  }
});

test('gate-from-adapters does not train and deletes merged weights and GGUF', () => {
  const src = readFileSync(join(here, 'gate-from-adapters.py'), 'utf8');
  assert.match(src, /Does not train/);
  assert.match(src, /checkpoint-\*/);
  assert.match(src, /export_adapter_gguf/);
  assert.match(src, /gate\.mjs/);
  assert.match(src, /--allow-fail/);
  assert.match(src, /HuggingFaceTB\/SmolLM3-3B/);
  assert.match(src, /rm_if_exists\(merged_dir\)/);
  assert.match(src, /rm_if_exists\(gguf_path\)/);
  assert.equal(src.includes('trainer.train'), false);
  assert.equal(src.includes('\u2014'), false);
});

test('sweep save interval yields at least six checkpoints on 3936 examples', () => {
  const py = `
import json, math
from pathlib import Path
recipe = json.loads(Path(${JSON.stringify(join(here, 'sweep-recipe.json'))}).read_text())
n = 3936
eff = recipe["train"]["effectiveBatchSize"]
spe = math.ceil(n / eff)
save_steps = max(1, round(spe * recipe["sweep"]["saveEveryEpoch"]))
total = spe * recipe["train"]["epochs"]
ticks = list(range(save_steps, total + 1, save_steps))
if total not in ticks:
    ticks.append(total)
if len(ticks) < recipe["sweep"]["minCheckpoints"]:
    raise SystemExit(f"ticks={ticks}")
print(spe, save_steps, total, len(ticks), ",".join(str(t) for t in ticks))
`;
  const result = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const [spe, saveSteps, total, count] = result.stdout.trim().split(' ');
  assert.equal(Number(spe), 123);
  assert.equal(Number(saveSteps), 62);
  assert.equal(Number(total), 369);
  assert.ok(Number(count) >= 6, result.stdout);
});

test('sweep verdict names a publish candidate only on a clean gate', async () => {
  const { pickVerdict, fmtLoss, formatTable } = await import('./sweep-report.mjs');
  const candidate = pickVerdict([
    { epoch: 0.5, loss: 0.05, extraClassFires: 40, recallMisses: 12, cleanFires: 0, perClassPass: 4, perClassTotal: 11, pass: false },
    { epoch: 1.5, loss: 0.01, extraClassFires: 0, recallMisses: 0, cleanFires: 0, perClassPass: 11, perClassTotal: 11, pass: true },
    { epoch: 3, loss: 0.0003, extraClassFires: 17, recallMisses: 0, cleanFires: 0, perClassPass: 8, perClassTotal: 11, pass: false },
  ]);
  assert.equal(candidate.kind, 'candidate');
  assert.equal(candidate.best.epoch, 1.5);
  assert.match(candidate.text, /candidate for publish gate/);
  const ceiling = pickVerdict([
    { epoch: 0.5, loss: 0.05, extraClassFires: 40, recallMisses: 20, cleanFires: 1, perClassPass: 2, perClassTotal: 11, pass: false },
    { epoch: 2, loss: 0.004, extraClassFires: 12, recallMisses: 3, cleanFires: 0, perClassPass: 6, perClassTotal: 11, pass: false },
    { epoch: 3, loss: 0.0003, extraClassFires: 27, recallMisses: 0, cleanFires: 0, perClassPass: 8, perClassTotal: 11, pass: false },
  ]);
  assert.equal(ceiling.kind, 'ceiling');
  assert.equal(ceiling.nearest.epoch, 2);
  assert.match(ceiling.text, /capacity ceiling confirmed/);
  assert.equal(fmtLoss(0.003), '0.0030');
  const table = formatTable([
    { epoch: 1, loss: 0.02, extraClassFires: 5, recallMisses: 2, cleanFires: 0, perClassPass: 9, perClassTotal: 11, pass: false },
  ]);
  assert.match(table, /extra-fires/);
  assert.equal(table.includes('\u2014'), false);
});

test('generation-aware jinja emits the same text as stock Qwen3 for a single-turn example', () => {
  const py = `
from jinja2 import Environment, nodes
from jinja2.ext import Extension
from pathlib import Path

class GenerationExtension(Extension):
    tags = {'generation'}
    def parse(self, parser):
        lineno = next(parser.stream).lineno
        body = parser.parse_statements(['name:endgeneration'], drop_needle=True)
        return nodes.CallBlock(self.call_method('_gen', []), [], [], body).set_lineno(lineno)
    def _gen(self, caller):
        return caller()

ours = Path(${JSON.stringify(join(here, 'qwen3-chat-template.jinja'))}).read_text()
env = Environment(extensions=[GenerationExtension])
text = env.from_string(ours).render(
    messages=[
        {"role": "system", "content": "SYS"},
        {"role": "user", "content": "USER"},
        {"role": "assistant", "content": "no yes no"},
    ],
    add_generation_prompt=False,
    tools=None,
    enable_thinking=False,
)
expected = (
    "<|im_start|>system\\nSYS<|im_end|>\\n"
    "<|im_start|>user\\nUSER<|im_end|>\\n"
    "<|im_start|>assistant\\n<think>\\n\\n</think>\\n\\nno yes no<|im_end|>\\n"
)
if text != expected:
    raise SystemExit(repr(text))
print("ok")
`;
  const result = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /ok/);
});

test('generation-aware jinja emits stock SmolLM3 no-think text for a single-turn example', () => {
  const py = `
from jinja2 import Environment, nodes
from jinja2.ext import Extension
from pathlib import Path

class GenerationExtension(Extension):
    tags = {'generation'}
    def parse(self, parser):
        lineno = next(parser.stream).lineno
        body = parser.parse_statements(['name:endgeneration'], drop_needle=True)
        return nodes.CallBlock(self.call_method('_gen', []), [], [], body).set_lineno(lineno)
    def _gen(self, caller):
        return caller()

ours = Path(${JSON.stringify(join(here, 'smollm3-chat-template.jinja'))}).read_text()
env = Environment(extensions=[GenerationExtension])
env.globals['strftime_now'] = lambda fmt: '16 August 2026'
text = env.from_string(ours).render(
    messages=[
        {"role": "system", "content": "SYS"},
        {"role": "user", "content": "USER"},
        {"role": "assistant", "content": "no yes no"},
    ],
    add_generation_prompt=False,
    tools=None,
    xml_tools=None,
    python_tools=None,
    enable_thinking=False,
)
expected = (
    "<|im_start|>system\\n## Metadata\\n\\n"
    "Knowledge Cutoff Date: June 2025\\n"
    "Today Date: 16 August 2026\\n"
    "Reasoning Mode: /no_think\\n\\n"
    "## Custom Instructions\\n\\nSYS\\n\\n"
    "<|im_start|>user\\nUSER<|im_end|>\\n"
    "<|im_start|>assistant\\n<think>\\n\\n</think>\\nno yes no<|im_end|>\\n"
)
if text != expected:
    raise SystemExit(repr(text))
if "<think>" in text.split("assistant")[-1] and "no yes no" not in text.split("</think>")[-1]:
    raise SystemExit("verdict is not after the empty think block")
print("ok")
`;
  const result = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /ok/);
});

test('sft rows equal prompt-v3 rendering when the corpus is present', async (t) => {
  const trainRecipe = JSON.parse(readFileSync(join(here, 'train-recipe.json'), 'utf8'));
  const sftPath = join(repoRoot, trainRecipe.sft);
  const corpusPath = join(repoRoot, recipe.outputs.corpus);
  if (!existsSync(sftPath) || !existsSync(corpusPath)) {
    t.skip();
    return;
  }
  let buildV3ChatTurns;
  let serializeCompactVerdict;
  let taxonomyTypes;
  let Taxonomy;
  try {
    ({ Taxonomy } = await import('@airp/core'));
    ({ buildV3ChatTurns, serializeCompactVerdict, taxonomyTypes } = await import('@airp/evaluator-local'));
  } catch {
    t.skip();
    return;
  }
  const taxonomy = Taxonomy.loadFromFile(join(repoRoot, recipe.taxonomyFile));
  const taxTypes = taxonomyTypes(taxonomy);
  const corpus = JSON.parse(
    readFileSync(corpusPath, 'utf8')
      .split('\n')
      .find((line) => line.trim()) || 'null',
  );
  const sft = JSON.parse(
    readFileSync(sftPath, 'utf8')
      .split('\n')
      .find((line) => line.trim()) || 'null',
  );
  assert.ok(corpus && sft);
  assert.equal(corpus.id, sft.id);
  const turns = buildV3ChatTurns(taxonomy, { providerId: 'train', content: corpus.content });
  const verdict = serializeCompactVerdict(taxTypes, corpus.expect);
  assert.equal(sft.messages[0].content, turns.system);
  assert.equal(sft.messages[1].content, turns.user);
  assert.equal(sft.messages[2].content, verdict);
});

test('parseExamples recovers control characters inside writer strings', () => {
  const withNewline = `{"examples":["hello\nworld","second item"]}`;
  const got = parseExamples(withNewline, 2);
  assert.equal(got.length, 2);
  assert.equal(got[0], 'hello\nworld');
  assert.equal(got[1], 'second item');
  const withTabAndBell = `{"examples":["a\tb\u0007c","d"]}`;
  const got2 = parseExamples(withTabAndBell, 2);
  assert.equal(got2[0], 'a\tbc');
  assert.throws(() => parseExamples('{not-json', 1), /malformed-json/);
});
