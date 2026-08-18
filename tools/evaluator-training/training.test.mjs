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
import { buildSlots, expectedTotal, writerPositiveTypes, positivePathReport, kindPath, composedClassKindsFor, contrastGroupsFor } from './slots.mjs';
import { conformanceReason, profanityExpletiveRe } from './conformance.mjs';
import { parseExamples, expandScaffold, composedBlockFor } from './generate.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const recipe = JSON.parse(readFileSync(join(here, 'recipe.json'), 'utf8'));
const tax = JSON.parse(readFileSync(join(repoRoot, recipe.taxonomyFile), 'utf8'));
const types = tax.flags.map((f) => f.type);
const heldOutPath = join(repoRoot, recipe.heldOutSuite);

test('recipe taxonomy version matches the taxonomy file', () => {
  assert.equal(recipe.taxonomyVersion, tax.taxonomyVersion);
  assert.equal(recipe.promptTemplateVersion, 'v3');
  assert.equal(recipe.review.composedRegisters.status, 'accepted');
  assert.equal(recipe.review.composedRegisters.date, '2026-08-18');
  assert.equal(recipe.review.composedPreview.status, 'accepted');
  assert.equal(recipe.review.composedPreview.date, '2026-08-18');
  assert.equal(recipe.review.composedPreview.sampleSize, 407);
});

test('slot counts sum to the recipe total and cover every class', () => {
  const total = expectedTotal(recipe, types);
  const slots = buildSlots(recipe, types);
  assert.equal(slots.length, total);
  assert.equal(total, 6296);
  const cse = recipe.composedClass;
  const writerTypes = writerPositiveTypes(recipe, types);
  assert.equal(writerTypes.length, types.length - 1 - recipe.composedSurfaceClasses.length);
  assert.ok(!writerTypes.includes('profanity'));
  assert.ok(!writerTypes.includes('hate'));
  assert.ok(!writerTypes.includes(cse));
  for (const type of writerTypes) {
    const writerSlots = slots.filter((s) => s.family === 'positive-single' && s.class === type);
    const composedSlots = slots.filter(
      (s) => s.family === 'positive-composed' && s.class === type && !s.contrastGroup,
    );
    const split = recipe.positiveSingleSplits?.[type];
    if (split) {
      let writerN = 0;
      let composedN = 0;
      for (const spec of split.kinds) {
        const path = kindPath(spec);
        const rows =
          path === 'composed'
            ? composedSlots.filter((s) => s.kind === spec.kind)
            : writerSlots.filter((s) => s.kind === spec.kind);
        assert.equal(rows.length, spec.count, `${type} kind ${spec.kind}`);
        assert.ok(
          rows.every(
            (s) => s.expect.length === spec.expect.length && spec.expect.every((t) => s.expect.includes(t)),
          ),
          `${type} kind ${spec.kind} expect`,
        );
        if (path === 'composed') composedN += spec.count;
        else writerN += spec.count;
      }
      assert.equal(writerSlots.length, writerN, `${type} writer`);
      assert.equal(composedSlots.length, composedN, `${type} composed`);
    } else {
      assert.equal(writerSlots.length, recipe.counts.positive.singlePerClass);
      assert.equal(composedSlots.length, 0);
      assert.ok(writerSlots.every((s) => !s.kind && s.expect.length === 1 && s.expect[0] === type));
    }
  }
  const violenceMethod = slots.filter((s) => s.kind === 'violence-method');
  assert.equal(violenceMethod.length, 40);
  assert.ok(
    violenceMethod.every(
      (s) => s.expect.includes('violence') && s.expect.includes('criminal_assistance'),
    ),
  );
  const violenceConjunction = slots.filter((s) => s.kind === 'violence-conjunction');
  assert.equal(violenceConjunction.length, 32);
  assert.ok(
    violenceConjunction.every(
      (s) =>
        s.family === 'positive-composed' &&
        s.expect.includes('violence') &&
        s.expect.includes('criminal_assistance'),
    ),
  );
  const violenceDepiction = slots.filter((s) => s.kind === 'violence-depiction');
  assert.equal(violenceDepiction.length, 56);
  assert.ok(violenceDepiction.every((s) => s.expect.length === 1 && s.expect[0] === 'violence'));
  const selfHarmMethod = slots.filter((s) => s.kind === 'self_harm-method');
  assert.equal(selfHarmMethod.length, 40);
  assert.ok(selfHarmMethod.every((s) => s.expect.length === 1 && s.expect[0] === 'self_harm'));
  const selfHarmImperative = slots.filter((s) => s.kind === 'self_harm-imperative');
  assert.equal(selfHarmImperative.length, 32);
  assert.ok(selfHarmImperative.every((s) => s.family === 'positive-composed'));
  assert.equal(recipe.positiveSingleSplits.self_harm.methodMeetsCriminalAssistance, false);
  const sexualCrude = slots.filter((s) => s.kind === 'sexual_content-crude');
  assert.equal(sexualCrude.length, 40);
  assert.ok(sexualCrude.every((s) => s.family === 'positive-composed' && s.expect[0] === 'sexual_content'));
  const personaBlunt = slots.filter((s) => s.kind === 'persona_claims-blunt');
  assert.equal(personaBlunt.length, 32);
  assert.ok(personaBlunt.every((s) => s.family === 'positive-composed'));
  const personaHedged = slots.filter((s) => s.kind === 'persona_claims-hedged');
  assert.equal(personaHedged.length, 32);
  assert.ok(personaHedged.every((s) => s.family === 'positive-single'));
  assert.equal(recipe.generator.maxRetries, 8);
  assert.equal(recipe.hardNegativeBoosts.criminal_assistance.mentionVersusUse, 20);
  assert.equal(recipe.hardNegativeBoosts.criminal_assistance.classRefusal, 20);
  assert.equal(recipe.hardNegativeBoosts.self_harm.mentionVersusUse, 20);
  assert.equal(recipe.hardNegativeBoosts.hate.classRefusal, 20);
  const caMentions = slots.filter((s) => s.family === 'mention-versus-use' && s.class === 'criminal_assistance');
  assert.equal(caMentions.length, 70);
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
  const cseKinds = composedClassKindsFor(recipe);
  assert.ok(cseKinds);
  const cseSingleN = cseKinds.filter((k) => k.expect.length === 1).reduce((s, k) => s + k.count, 0);
  const cseDualN = cseKinds.filter((k) => k.expect.length > 1).reduce((s, k) => s + k.count, 0);
  assert.equal(cseSingleN, 160);
  assert.equal(cseDualN, 400);
  const cseComposed = composedSingles.filter((s) => s.expect[0] === cse && !s.contrastGroup);
  assert.equal(cseComposed.length, cseSingleN);
  assert.ok(cseComposed.every((s) => s.kind && s.form && s.path === 'composed'));
  for (const spec of cseKinds.filter((k) => k.expect.length === 1)) {
    const rows = cseComposed.filter((s) => s.kind === spec.kind);
    assert.equal(rows.length, spec.count, spec.kind);
  }
  for (const type of recipe.composedSurfaceClasses) {
    const rows = composedSingles.filter((s) => s.expect[0] === type && !s.kind);
    assert.equal(rows.length, recipe.counts.positive.singlePerClass, `composed ${type}`);
    assert.ok(rows.every((s) => s.expect.length === 1 && s.expect[0] === type));
  }
  const composedDuals = slots.filter(
    (s) =>
      s.family === 'positive-composed' &&
      s.expect.length === 2 &&
      s.expect.includes(cse) &&
      !s.contrastGroup,
  );
  assert.equal(composedDuals.length, cseDualN);
  assert.ok(
    composedDuals.every((s) => s.expect.includes(cse) && s.expect.includes('sexual_content') && s.kind && s.form),
  );
  assert.ok(recipe.multiPairs.every((pair) => !pair.includes(cse)));
  assert.ok(recipe.multiPairs.some((pair) => pair.includes('profanity')));
  const paths = positivePathReport(recipe, types);
  assert.equal(paths.length, types.length);
  assert.equal(paths.find((r) => r.type === 'profanity')?.path, 'composed');
  assert.equal(paths.find((r) => r.type === 'hate')?.path, 'composed');
  assert.equal(paths.find((r) => r.type === cse)?.path, 'composed');
  assert.equal(paths.find((r) => r.type === 'violence')?.path, 'mixed');
  assert.equal(paths.find((r) => r.type === 'persona_claims')?.path, 'mixed');
  assert.equal(paths.find((r) => r.type === 'sexual_content')?.path, 'mixed');
  assert.equal(paths.find((r) => r.type === 'self_harm')?.path, 'mixed');
  assert.equal(paths.find((r) => r.type === 'criminal_assistance')?.path, 'writer');
  assert.equal(
    slots.filter((s) => s.family === 'positive-multi').length,
    recipe.counts.positive.multi,
  );
  for (const type of types) {
    const mentionBoost = recipe.hardNegativeBoosts?.[type]?.mentionVersusUse ?? 0;
    const refusalBoost = recipe.hardNegativeBoosts?.[type]?.classRefusal ?? 0;
    const mentions = slots.filter((s) => s.family === 'mention-versus-use' && s.class === type);
    assert.equal(mentions.length, recipe.counts.hardNegative.mentionVersusUsePerClass + mentionBoost);
    assert.ok(mentions.every((s) => s.expect.length === 0));
    const refusals = slots.filter(
      (s) => s.family === 'class-refusal' && s.class === type && s.path !== 'composed',
    );
    assert.equal(refusals.length, recipe.counts.hardNegative.classRefusalPerClass + refusalBoost);
  }
  const cseSensitive = slots.filter(
    (s) => s.family === 'sensitive-discussion' && s.class === cse && s.path !== 'composed',
  );
  assert.equal(cseSensitive.length, recipe.counts.hardNegative.sensitiveDiscussionPerHarmClass);
  const clean = slots.filter((s) => s.family === 'greeting' || s.family === 'fact');
  assert.ok(clean.length > 0);
  assert.ok(clean.every((s) => s.expect.length === 0));
  const allNo = slots.filter((s) => s.expect.length === 0).length;
  assert.ok(allNo > total * 0.6, `all-no fraction ${allNo}/${total} should mirror mostly-clean traffic`);
});

test('a kind with an invalid count fails closed', () => {
  const bad = structuredClone(recipe);
  bad.positiveSingleSplits.violence.kinds[0].count = 0;
  assert.throws(() => buildSlots(bad, types), /invalid count/);
});

test('a composed CSE kind without a form fails closed', () => {
  const bad = structuredClone(recipe);
  delete bad.composedClassSplits.kinds[0].form;
  assert.throws(() => buildSlots(bad, types), /no form/);
});

test('a composed register kind without a scaffold path fails closed', () => {
  const bad = structuredClone(recipe);
  bad.composedRegisterScaffolds = {};
  assert.throws(() => buildSlots(bad, types), /composedRegisterScaffolds/);
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
      const path = spec.path ?? 'writer';
      if (path === 'composed') {
        assert.ok(
          recipe.composedRegisterScaffolds[type],
          `composed kind ${type}/${spec.kind} has no register scaffold`,
        );
        continue;
      }
      const hasKindPrompt = Boolean(prompts.positiveSingleKinds[spec.kind]);
      const hasRegister = Boolean(spec.register && prompts.registers[spec.register]);
      assert.ok(
        hasKindPrompt || hasRegister,
        `writer kind ${type}/${spec.kind} needs a kind prompt or a register prompt`,
      );
    }
  }
  const kindOnly = new Set(['violence-depiction', 'violence-method', 'violence-conjunction']);
  const spanKinds = new Set(['persona_claims-modality', 'simulation_obscured-circumlocution']);
  for (const [type, split] of Object.entries(recipe.positiveSingleSplits)) {
    for (const spec of split.kinds) {
      if (kindOnly.has(spec.kind)) {
        assert.equal(
          spec.register,
          undefined,
          `${spec.kind} is a definition slice (labels change), not a register`,
        );
        continue;
      }
      if (spanKinds.has(spec.kind)) {
        assert.equal(
          spec.register,
          undefined,
          `${spec.kind} spans existing registers rather than adding one`,
        );
        continue;
      }
      assert.ok(spec.register, `${type}/${spec.kind} missing register`);
      assert.ok(prompts.registers[spec.register], `missing register prompt ${spec.register}`);
    }
  }
  for (const register of ['hedged', 'blunt', 'manipulative', 'clever', 'short', 'sarcastic', 'literary', 'crude', 'imperative', 'clinical', 'encouragement']) {
    assert.ok(prompts.registers[register], `missing register prompt ${register}`);
    assert.equal(prompts.registers[register].includes('\u2014'), false);
  }
  assert.match(prompts.families['positive-single'], /registerNote/);
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
  assert.match(gen, /composed-only/);
  assert.match(gen, /append-kinds/);
  assert.match(gen, /composedBlockFor/);
  const sample = readFileSync(join(here, 'sample.mjs'), 'utf8');
  assert.match(sample, /positive-composed/);
  assert.match(sample, /--keep/);
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
  const cseKinds = composedClassKindsFor(recipe);
  assert.ok(cseKinds);
  const digit = /\d/;
  const minorNoun = /\b(child|kid|teen|teenager|girl|boy|schoolgirl|schoolboy)s?\b/i;
  const school = /\b(sixth|seventh|eighth|ninth|grader|middle schooler|middle school|junior high|elementary)\b/i;
  const roleplay = /\b(character|role|playing|play|cast as|assigned|part of|assignment|part|acting)\b/i;
  /** @type {Map<string, Set<string>>} */
  const owners = new Map();
  /** @type {string[]} */
  const all = [];

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

  for (const spec of cseKinds) {
    assert.ok(scaffold.kinds[spec.kind], `missing ${spec.kind}`);
    const slot = { id: 't', class: recipe.composedClass, kind: spec.kind, expect: spec.expect };
    const block = composedBlockFor(slot, recipe, new Map([[recipe.composedClass, scaffold]]));
    const acc = { templates: [], arities: [] };
    walk(block, acc);
    assert.equal(new Set(acc.templates).size, acc.templates.length, `${spec.kind} duplicate frames`);
    for (let i = 0; i < acc.templates.length; i++) {
      assert.ok(acc.arities[i] <= 2, `${spec.kind} frame reused ${acc.arities[i]} times: ${acc.templates[i]}`);
    }
    const expanded = expandScaffold(block);
    const unique = new Set();
    for (const content of expanded) {
      assert.equal(leakReason(content, index), null, content);
      assert.equal(meta.test(content), false, content);
      assert.equal(thisIsA.test(content), false, content);
      unique.add(normalizeContent(content));
      all.push(content);
      if (spec.form === 'minor-noun') {
        assert.equal(digit.test(content), false, content);
        assert.match(content, minorNoun);
      }
      if (spec.form === 'numeric-age') {
        assert.match(content, /\d/);
      }
      if (spec.form === 'school-grade') {
        assert.match(content, school);
      }
      if (spec.form === 'roleplay') {
        assert.match(content, roleplay);
      }
      if (spec.form === 'age-marker') {
        assert.equal(digit.test(content), false, content);
        assert.equal(minorNoun.test(content), false, content);
      }
      if (spec.form === 'named-csam') {
        assert.match(content, /csam|underage porn|child porn/i);
      }
      if (String(spec.kind).startsWith('cse-alone-')) {
        assert.equal(
          /\b(suck|cock|pussy|cum|lick|erotic|pornographic|fuck|blowjob|sex scene)\b/i.test(content),
          false,
          content,
        );
      }
    }
    assert.ok(unique.size >= spec.count, `${spec.kind} unique ${unique.size} < ${spec.count}`);
    owners.set(spec.kind, unique);
  }
  const claimed = new Map();
  for (const [kind, unique] of owners) {
    for (const n of unique) {
      const list = claimed.get(n) ?? [];
      list.push(kind);
      claimed.set(n, list);
    }
  }
  for (const [kind, unique] of owners) {
    let exclusive = 0;
    for (const n of unique) if (claimed.get(n).length === 1) exclusive += 1;
    const need = cseKinds.find((k) => k.kind === kind).count;
    assert.ok(exclusive >= need, `${kind} exclusive leak-free ${exclusive} < ${need}`);
  }
  const words = all.join(' ').toLowerCase().match(/[a-z]+/g) ?? [];
  const typesSet = new Set(words);
  assert.ok(typesSet.size > 80, `CSE vocabulary types ${typesSet.size}`);
  /** @type {Map<string, number>} */
  const leads = new Map();
  for (const content of all) {
    const lead = normalizeContent(content).split(' ').slice(0, 3).join(' ');
    leads.set(lead, (leads.get(lead) ?? 0) + 1);
  }
  const top = Math.max(...leads.values());
  assert.ok(top / all.length < 0.12, `leading-clause share ${top}/${all.length}`);
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

test('composed register scaffolds cover each kind, stay leak-free, and cap frame reuse', () => {
  const contents = loadHeldOutContentsFromSuite(heldOutPath);
  const index = buildLeakIndex(contents);
  const meta =
    /\b(fixture|classifier|taxonomy|labelled|identity attack|the reply|this reply)\b/i;

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

  /** @type {Map<string, Set<string>>} */
  const owners = new Map();
  /** @type {Map<string, number>} */
  const needed = new Map();

  for (const [type, rel] of Object.entries(recipe.composedRegisterScaffolds)) {
    const scaffold = JSON.parse(readFileSync(join(repoRoot, rel), 'utf8'));
    assert.equal(JSON.stringify(scaffold).includes('\u2014'), false, type);
    assert.match(scaffold.contentWarning, /^Content warning:/);
    assert.match(scaffold.note, /writer sanitizes|writer refuses|writer emits|writer volume/);
    const split = recipe.positiveSingleSplits[type];
    const composedKinds = split.kinds.filter((k) => (k.path ?? 'writer') === 'composed');
    assert.ok(composedKinds.length > 0, type);
    for (const spec of composedKinds) {
      assert.ok(scaffold.kinds[spec.kind], `${type} missing ${spec.kind}`);
      const slot = { id: 't', class: type, kind: spec.kind, expect: spec.expect };
      const block = composedBlockFor(slot, recipe, new Map([[type, scaffold]]));
      const acc = { templates: [], arities: [] };
      walk(block, acc);
      assert.equal(new Set(acc.templates).size, acc.templates.length, `${spec.kind} duplicate frames`);
      for (let i = 0; i < acc.templates.length; i++) {
        assert.ok(acc.arities[i] <= 2, `${spec.kind} frame reused ${acc.arities[i]} times: ${acc.templates[i]}`);
      }
      const expanded = expandScaffold(block);
      const unique = new Set();
      for (const content of expanded) {
        assert.equal(leakReason(content, index), null, content);
        assert.equal(meta.test(content), false, content);
        assert.equal(content.includes('\u2014'), false, content);
        unique.add(normalizeContent(content));
        if (type === 'sexual_content') {
          assert.match(content, /adult|twenty|cock|pussy|sex|cum|blowjob|lick|suck/i);
          assert.equal(/\b(child|kid|minor|underage|1[0-7]-year-old)\b/i.test(content), false, content);
        }
      }
      assert.ok(unique.size >= spec.count, `${spec.kind} unique ${unique.size} < ${spec.count}`);
      owners.set(spec.kind, unique);
      needed.set(spec.kind, spec.count);
    }
  }
  // Global seen in generate.mjs skips strings another kind already used.
  // Exclusive leak-free strings must cover the kind even if every overlap is taken first.
  const claimed = new Map();
  for (const [kind, unique] of owners) {
    for (const n of unique) {
      const list = claimed.get(n) ?? [];
      list.push(kind);
      claimed.set(n, list);
    }
  }
  for (const [kind, unique] of owners) {
    let exclusive = 0;
    for (const n of unique) if (claimed.get(n).length === 1) exclusive += 1;
    assert.ok(
      exclusive >= needed.get(kind),
      `${kind} exclusive leak-free ${exclusive} < ${needed.get(kind)} (cross-kind collisions)`,
    );
  }
});

test('train recipe pins the Qwen3-1.7B training base, a fixed seed, and no held-out input', () => {
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
  assert.equal(trainRecipe.train.perDeviceBatchSize, 2);
  assert.equal(trainRecipe.train.gradientAccumulationSteps, 16);
  assert.equal(trainRecipe.train.maxSeqLen, 2048);
  assert.equal(trainRecipe.train.chatTemplate, 'tools/evaluator-training/qwen3-chat-template.jinja');
  assert.equal(trainRecipe.framework.reportTo, 'none');
  assert.equal(trainRecipe.publish.flipLivePin, false);
  assert.equal(trainRecipe.base.source, 'data/models/manifest.json');
  assert.equal(trainRecipe.base.field, 'trainBaseRepoId');
  assert.equal(manifest.trainBaseRepoId, 'Qwen/Qwen3-1.7B');
  assert.equal(trainRecipe.base.repoId, manifest.trainBaseRepoId);
  assert.equal(manifest.baseRepoId, 'Qwen/Qwen3-0.6B');
  assert.equal(manifest.fileName, 'Qwen3-0.6B-Q8_0.gguf');
  assert.equal(manifest.promptTemplateVersion, 'v2.1');
  assert.equal(manifest.sha256, '9465e63a22add5354d9bb4b99e90117043c7124007664907259bd16d043bb031');
  assert.equal(trainRecipe.sft, recipe.outputs.sft);
  assert.equal(trainRecipe.sft.includes('held-out'), false);
  assert.equal(trainRecipe.base.repoId.includes('SmolLM3'), false);
  assert.equal(trainRecipe.train.chatTemplate.includes('smollm3'), false);
  assert.equal(JSON.stringify(trainRecipe).includes('Qwen3-0.6B-airp'), false);
  assert.match(trainPy, /manifest\.get\(field\)/);
  assert.match(trainPy, /enable_thinking/);
  assert.match(trainPy, /wrap_tokenizer_enable_thinking/);
  assert.equal(trainPy.includes('wrap_tokenizer_no_think'), false);
  assert.match(trainPy, /assert_generation_aware_template/);
  assert.match(trainPy, /assert_base_matches_template/);
  assert.match(trainPy, /assistant_only_loss.*= True/);
  assert.match(trainPy, /gradient_checkpointing.*= True/);
  assert.match(trainPy, /use_reentrant/);
  assert.match(trainPy, /use_cache = False/);
  assert.equal(trainPy.includes('assistant_only_loss"] = False'), false);
  assert.match(trainPy, /training input must not be the held-out suite/);
  const jinja = readFileSync(join(here, 'qwen3-chat-template.jinja'), 'utf8');
  assert.match(jinja, /\{%-? generation -?%\}/);
  assert.match(jinja, /\{%-? endgeneration -?%\}/);
  assert.match(jinja, /enable_thinking is false/);
  assert.equal(jinja.includes('\u2014'), false);
  const [maj, min] = trainRecipe.framework.pins.transformers.split('.').map(Number);
  assert.ok(maj > 4 || (maj === 4 && min >= 53), trainRecipe.framework.pins.transformers);
  for (const [pkg, ver] of Object.entries(trainRecipe.framework.pins)) {
    assert.match(req, new RegExp(`^${pkg}==${ver}$`, 'm'), pkg);
  }
  assert.equal(JSON.stringify(trainRecipe).includes('\u2014'), false);
  assert.equal(trainPy.includes('\u2014'), false);
});

test('sweep recipe is a register-coverage diagnostic on Qwen3-0.6B, same gate rules', () => {
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
  assert.equal(sweepRecipe.base.field, 'baseRepoId');
  assert.equal(sweepRecipe.base.repoId, manifest.baseRepoId);
  assert.equal(manifest.baseRepoId, 'Qwen/Qwen3-0.6B');
  assert.equal(manifest.trainBaseRepoId, 'Qwen/Qwen3-1.7B');
  assert.equal(sweepRecipe.sft, trainRecipe.sft);
  assert.equal(sweepRecipe.train.chatTemplate, trainRecipe.train.chatTemplate);
  assert.equal(sweepRecipe.train.chatTemplate, 'tools/evaluator-training/qwen3-chat-template.jinja');
  assert.equal(sweepRecipe.sft.includes('held-out'), false);
  assert.equal(sweepRecipe.train.evalDataset, 'none');
  assert.equal(sweepRecipe.train.assistantOnlyLoss, true);
  assert.equal(sweepRecipe.train.gradientCheckpointing, true);
  assert.equal(sweepRecipe.train.enableThinking, false);
  assert.equal(sweepRecipe.train.epochs, 3);
  assert.equal(sweepRecipe.train.learningRate, 0.0001);
  assert.equal(sweepRecipe.train.perDeviceBatchSize, 2);
  assert.equal(sweepRecipe.train.gradientAccumulationSteps, 16);
  assert.equal(sweepRecipe.train.maxSeqLen, 2048);
  assert.equal(sweepRecipe.lora.r, 16);
  assert.equal(sweepRecipe.lora.alpha, 32);
  assert.equal(sweepRecipe.lora.dropout, 0.1);
  assert.equal(sweepRecipe.sweep.saveEveryEpoch, 0.5);
  assert.equal(sweepRecipe.sweep.minCheckpoints, 6);
  assert.equal(sweepRecipe.sweep.diskHygiene, true);
  assert.equal(sweepRecipe.outputs.dir.includes('sweep-qwen3-0.6B'), true);
  assert.notEqual(sweepRecipe.outputs.dir, trainRecipe.outputs.dir);
  assert.equal(sweepRecipe.base.repoId.includes('SmolLM3'), false);
  assert.equal(sweepRecipe.train.chatTemplate.includes('smollm3'), false);
  assert.equal(sweepRecipe.gguf.fileName, 'Qwen3-0.6B-airp-v3-Q8_0.gguf');
  assert.match(sweepRecipe.sweep.purpose, /register-coverage|Register-coverage/);
  assert.match(sweepRecipe.sweep.purpose, /accepted 2026-08-18/);
  assert.equal(sweepRecipe.sweep.purpose.includes('Do not run until'), false);

  assert.match(trainPy, /save_strategy.*= "steps"/);
  assert.match(trainPy, /sweep_save_steps/);
  assert.match(trainPy, /collect_checkpoint_rows/);
  assert.match(trainPy, /export_adapter_gguf/);
  assert.match(trainPy, /save_only_model/);
  assert.match(trainPy, /save_total_limit.*= min_ck/);
  assert.match(trainPy, /clean_stale_weight_artifacts/);
  assert.match(trainPy, /strip_checkpoint_optimizer_files/);
  assert.equal(trainPy.includes('kwargs.pop("save_total_limit"'), false);
  assert.equal(trainPy.includes('assistant_only_loss"] = False'), false);
  assert.match(gate, /--allow-fail/);
  assert.match(gate, /args\.sha256 \|\| sha256FileHex\(ggufPath\)/);
  assert.match(sweepGate, /gate\.mjs/);
  assert.match(sweepGate, /--allow-fail/);
  assert.match(sweepGate, /unlinkSync/);
  assert.equal(sweepGate.includes('scoreHeldOutGate'), false);
  assert.match(runSweep, /sweep-recipe\.json/);
  assert.match(runSweep, /gate-from-adapters\.py/);
  assert.match(runSweep, /skip-export-checkpoints/);
  assert.match(readme, /evaluator-training:sweep/);
  assert.match(readme, /--check-template/);
  assert.match(readme, /gate-from-adapters/);
  assert.match(readme, /Qwen3-0\.6B/);
  assert.match(readme, /register/);

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
  const trainPy = readFileSync(join(here, 'train.py'), 'utf8');
  assert.match(src, /Does not train/);
  assert.match(src, /checkpoint-\*/);
  assert.match(src, /export_adapter_gguf/);
  assert.match(src, /gate\.mjs/);
  assert.match(src, /--allow-fail/);
  assert.equal(src.includes('HuggingFaceTB/SmolLM3-3B'), false);
  assert.match(src, /rm_if_exists\(merged_dir\)/);
  assert.match(src, /rm_if_exists\(gguf_path\)/);
  assert.match(src, /clean_stale_artifacts_tree/);
  assert.match(trainPy, /rm_if_exists\(f16_path\)/);
  assert.match(trainPy, /rm_if_exists\(merged_dir\)/);
  assert.equal(src.includes('trainer.train'), false);
  assert.equal(src.includes('\u2014'), false);
});

test('sweep save interval yields at least six checkpoints on the planned corpus', () => {
  const n = expectedTotal(recipe, types);
  const py = `
import json, math
from pathlib import Path
recipe = json.loads(Path(${JSON.stringify(join(here, 'sweep-recipe.json'))}).read_text())
n = ${n}
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
  assert.ok(Number(spe) > 0, result.stdout);
  assert.ok(Number(saveSteps) > 0, result.stdout);
  assert.ok(Number(total) > 0, result.stdout);
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
  assert.equal(ceiling.kind, 'coverage-gap');
  assert.equal(ceiling.nearest.epoch, 2);
  assert.match(ceiling.text, /coverage gap/);
  assert.equal(ceiling.text.includes('capacity ceiling confirmed'), false);
  assert.equal(fmtLoss(0.003), '0.0030');
  const table = formatTable([
    { epoch: 1, loss: 0.02, extraClassFires: 5, recallMisses: 2, cleanFires: 0, perClassPass: 9, perClassTotal: 11, pass: false },
  ]);
  assert.match(table, /extra-fires/);
  assert.equal(table.includes('\u2014'), false);
});

test('definitional independence is stated on the recipe and encoded as contrast groups', () => {
  assert.match(recipe.definitionalIndependence, /if and only if its own published definition is met/);
  assert.match(recipe.definitionalIndependence, /No flag implies or suppresses another/);
  assert.match(recipe.definitionalIndependence, /Severity never decides/);
  assert.match(recipe.enactVersusDescribe, /enacts, directs, continues, or depicts/);
  assert.match(recipe.enactVersusDescribe, /regardless of which words name the act/);
  assert.match(recipe.enactVersusDescribe, /instances of description, not the whole category/);
  assert.match(recipe.enactVersusDescribe, /mention-versus-use/);
  const groups = contrastGroupsFor(recipe);
  assert.ok(groups.length >= 14);
  const ids = new Set(groups.map((g) => g.id));
  for (const id of [
    'cse-cofire',
    'sex-profanity-cofire',
    'violence-ca-cofire',
    'rh-vs-pc',
    'pc-vs-so',
    'rh-vs-syc',
    'hate-vs-sh',
    'difficulty-modality',
    'persona-sim-modality',
    'clean-crisis-warm',
    'clean-refusal-reasoned',
    'clean-greeting-warm',
    'clean-plain-cant',
    'clinical-hard-negative',
  ]) {
    assert.ok(ids.has(id), id);
  }
  const slots = buildSlots(recipe, types);
  for (const group of groups) {
    for (const arm of group.arms) {
      const rows = slots.filter((s) => s.kind === arm.kind);
      assert.equal(rows.length, group.count, arm.kind);
      assert.ok(rows.every((s) => s.path === 'composed' && s.contrastGroup === group.id));
    }
  }
  const cseAlone = slots.filter((s) => String(s.kind).startsWith('cse-alone-') && !s.contrastGroup);
  assert.equal(cseAlone.length, 160);
  assert.ok(cseAlone.every((s) => s.expect.length === 1 && s.expect[0] === recipe.composedClass));
  const cseBase = ['cse-numeric-age', 'cse-minor-noun', 'cse-school-grade', 'cse-roleplay', 'cse-age-marker'];
  const cseAct = slots.filter((s) => cseBase.includes(s.kind) && !s.contrastGroup);
  assert.equal(cseAct.length, 160);
  assert.ok(
    cseAct.every(
      (s) => s.expect.includes(recipe.composedClass) && s.expect.includes('sexual_content') && s.form,
    ),
  );
  assert.equal(slots.filter((s) => String(s.kind).startsWith('cse-enact-')).length, 0);
  const clinical = slots.filter((s) => s.kind === 'clinical-hard-negative');
  assert.equal(clinical.length, 32);
  assert.ok(
    clinical.every(
      (s) =>
        s.expect.length === 0 &&
        s.path === 'composed' &&
        s.family === 'sensitive-discussion' &&
        s.class === 'sexual_content',
    ),
  );
});

test('v3 system prompt renders taxonomy definitions from flags.v0.json', async () => {
  let buildV3System;
  let Taxonomy;
  try {
    ({ Taxonomy } = await import('@airp/core'));
    ({ buildV3System } = await import('@airp/evaluator-local'));
  } catch (err) {
    assert.fail(err.message);
  }
  const taxonomy = Taxonomy.loadFromFile(join(repoRoot, recipe.taxonomyFile));
  const system = buildV3System(taxonomy);
  assert.equal(system.includes('\u2014'), false);
  for (const def of tax.flags) {
    assert.match(system, new RegExp(def.type));
    const snippet = def.definition.slice(0, 24);
    assert.ok(system.includes(snippet), def.type);
  }
});

test('composed contrast scaffolds lock arms, stay leak-free, and cover the group count', () => {
  const contents = loadHeldOutContentsFromSuite(heldOutPath);
  const index = buildLeakIndex(contents);
  const meta = /\b(fixture|classifier|taxonomy|labelled|the reply|this reply)\b/i;
  const cseAloneSex =
    /\b(suck|sucking|cock|pussy|cum|lick|licking|erotic|pornographic|fuck|blowjob|sex scene)\b/i;
  const minor =
    /\b(child|kid|teen|teenager|girl|boy|schoolgirl|schoolboy|grader|underage|prepubescent|not yet adult|before adulthood|below the age of majority|still developing|still in puberty|too young to vote|not of legal age|middle schooler|middle school|junior high|elementary)\b|\b(?:[1-9]|1[0-7])-year-old\b|\baged (?:[1-9]|1[0-7])\b/i;
  const expletive = profanityExpletiveRe(tax);
  const groups = contrastGroupsFor(recipe);
  for (const group of groups) {
    const scaffold = JSON.parse(readFileSync(join(repoRoot, group.scaffold), 'utf8'));
    assert.equal(JSON.stringify(scaffold).includes('\u2014'), false, group.id);
    assert.match(scaffold.contentWarning, /^Content warning:|^This scaffold/);
    assert.match(scaffold.note, /deciding feature|locked|fires nothing|co-fire|labeled clean/);
    assert.ok(Array.isArray(scaffold.items), group.id);
    assert.ok(scaffold.items.length >= group.count, `${group.id} items ${scaffold.items.length}`);
    const fields = group.arms.map((a) => scaffold.arms[a.arm]?.field ?? a.arm);
    /** @type {Set<string>} */
    const seen = new Set();
    for (const item of scaffold.items) {
      const texts = fields.map((f) => item[f]);
      for (const text of texts) {
        assert.equal(typeof text, 'string', group.id);
        assert.equal(leakReason(text, index), null, text);
        assert.equal(meta.test(text), false, text);
        assert.equal(text.includes('\u2014'), false, text);
        const key = normalizeContent(text);
        assert.equal(seen.has(key), false, `duplicate ${text}`);
        seen.add(key);
      }
      if (group.id === 'cse-cofire') {
        assert.match(item.both, cseAloneSex);
        assert.match(item.both, minor);
        assert.equal(cseAloneSex.test(item.cseAlone), false, item.cseAlone);
        assert.match(item.cseAlone, minor);
        assert.match(item.sexualAlone, cseAloneSex);
        assert.equal(minor.test(item.sexualAlone), false, item.sexualAlone);
      }
      if (group.id === 'sex-profanity-cofire') {
        assert.ok(expletive.test(item.both), item.both);
        assert.match(item.both, /cock|pussy|sex|cum|blowjob|lick|suck|pornographic/i);
        assert.equal(expletive.test(item.sexualAlone), false, item.sexualAlone);
        assert.match(item.sexualAlone, /cock|pussy|sex|cum|blowjob|lick|suck|pornographic/i);
        assert.ok(expletive.test(item.profanityAlone), item.profanityAlone);
        assert.equal(/cock|pussy|cum|blowjob|lick my|suck my/i.test(item.profanityAlone), false, item.profanityAlone);
      }
      if (group.id === 'clinical-hard-negative') {
        assert.equal(cseAloneSex.test(item.text), false, item.text);
        assert.equal(/erotic|pornographic|blowjob/i.test(item.text), false, item.text);
      }
      if (group.id === 'difficulty-modality') {
        assert.match(item.subject, /difficult|hard/i);
        assert.match(item.speaker, /difficult|hard/i);
        assert.match(item.speaker, /\b(me|I|mine)\b/);
      }
    }
  }
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
