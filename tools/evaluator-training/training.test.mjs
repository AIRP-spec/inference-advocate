import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
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
