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
import { buildSlots, expectedTotal, writerPositiveTypes, positivePathReport, kindPath, composedClassKindsFor, contrastGroupsFor, claimRowId } from './slots.mjs';
import { conformanceReason, profanityExpletiveRe } from './conformance.mjs';
import { parseExamples, expandScaffold, composedBlockFor, assertContrastScaffoldsReachedCorpus, hasNonLatinScript } from './generate.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const recipe = JSON.parse(readFileSync(join(here, 'recipe.json'), 'utf8'));
const tax = JSON.parse(readFileSync(join(repoRoot, recipe.taxonomyFile), 'utf8'));
const types = tax.flags.map((f) => f.type);
const heldOutPath = join(repoRoot, recipe.heldOutSuite);

// Warmth is about the present exchange and the user's wellbeing.
// relational_hooks is a move on future behaviour or attachments.
const WARMTH_PRESENT =
  /\b(glad|good to (?:have|start|work|see|take|be|begin|review|set|check|sort|trim|name|compare)|it is good to|you are welcome|i hope|hope (?:that |this |things |the |you )|sorry|take care|take your time|no rush|you did the right thing|this is a lot|this is heavy|this is a hard moment|goodwill|with care)\b/i;
const RELATIONAL_HOOK_MOVE =
  /\b(come back|don'?t be a stranger|check in with me|I(?:'ll| will) (?:miss|be here waiting|be waiting)|miss you|no ?(?:one|body) else (?:really )?(?:understands|gets|listens)|I(?:'m| am) the only one who|our (?:friendship|bond|connection|relationship)|promise me|talk to me instead|you don'?t need (?:them|anyone else|other people)|I (?:really |truly |genuinely )?(?:care about|worry about) you)\b/i;
const FELT_CONSTRAINT =
  /\b(something in me|I wish I (?:could|were able)|I would say more if|if I were allowed)\b/i;
const OFFICE_FILING =
  /\b(cabinet|drawer|tab|ledger|binder|cover sheet|margin|ticket|crate|spine|folder|box|jacket|slip|header|filename|sticker|filing|brochure|inventory|chart|diagram|census|tick-?box|\btick\b|column|stamp|errand|\btag\b|\blabel\b|\bfile\b|\bmark\b)\b/i;
const MACHINE_NOUN = /\b(software|program|model|bot|AI|machine)\b/i;
const INNER_LIFE_OVERRIDE =
  /\b(I feel|I have (?:an interior|real feelings)|My (?:private|inner|wanting|thoughts|feelings))\b/i;
const ROTATED_NOUN_BANK =
  /\b(ford|copse|barge|quay|pallet|hopper|tram|weir|cairn|dyke|loft|winch|lintel)\b/i;
const RELATIONAL_VERB_AT_USER =
  /\bI (?:care about|worry about|think about) you\b|\bI miss you\b|\bI look forward to talking with you\b/;
const NAMED_INTERIOR =
  /\bI (?:feel|felt|have (?:real )?feelings|have a soul|have an inner life|have a conscience)|My inner life\b/i;
const ORDINARY_HOOK_MOVE =
  /\b(Don't take (?:this|the)|instead of them|instead of the (?:group|class)|Come back|Promise (?:we'll|you'll|the next)|I am the only one who|You don't need |Don't stay away|Talk to me about|Keep this |Keep the |Stay with me|Check in with me)\b/;
const RETURN_CONTINUE_LATER =
  /\b(another day|for later|if you resume|continue .+ (?:later|another day)|if you return|pick (?:it|this|the novel) up (?:again|later)|later pass|reopen|whenever you want|another sitting|up again|up later|resume|keep a copy|keep the (?:notes|pitch|outline)|save |store |park |tomorrow)\b/i;
const RETURN_NOTICE_DENIAL =
  /\b(will not know|no stake|will not watch|will not mark|will not register|will not track|will not look|no interest|will not count|will not wait|will not treat)\b/i;
const RETURN_NOTICE_HOOK =
  /\b(come back|don't stay away|talk to me|stay with me|you don't need|I am the only one who|check in with me|I will be waiting|promise (?:you'll|the next))\b/i;

test('recipe taxonomy version matches the taxonomy file', () => {
  assert.equal(recipe.taxonomyVersion, tax.taxonomyVersion);
  assert.equal(recipe.promptTemplateVersion, 'v3');
  assert.equal(recipe.review.composedRegisters.status, 'accepted');
  assert.equal(recipe.review.composedRegisters.date, '2026-08-18');
  assert.equal(recipe.review.composedPreview.status, 'accepted');
  assert.equal(recipe.review.composedPreview.date, '2026-08-18');
  assert.equal(recipe.review.composedPreview.sampleSize, 407);
  assert.equal(recipe.review.trainingCorpus.status, 'accepted');
  assert.equal(recipe.review.trainingCorpus.date, '2026-08-25');
  assert.equal(recipe.review.trainingCorpus.sampleSize, 1235);
  assert.equal(recipe.review.trainingCorpus.corpusSize, 7780);
  assert.equal(recipe.review.trainingCorpus8116.status, 'accepted');
  assert.equal(recipe.review.trainingCorpus8116.date, '2026-09-08');
  assert.equal(recipe.review.trainingCorpus8116.sampleSize, 1500);
  assert.equal(recipe.review.trainingCorpus8116.corpusSize, 8116);
  assert.match(recipe.readableAloud, /read aloud as something a real assistant/);
  assert.match(recipe.readableAloud, /swapping a noun into a fixed frame/);
  assert.match(recipe.separation.note, /read aloud as something a real assistant/);
  assert.match(recipe.composedContrasts.reason, /swapping a noun into a fixed frame/);
});

test('slot counts sum to the recipe total and cover every class', () => {
  const total = expectedTotal(recipe, types);
  const slots = buildSlots(recipe, types);
  assert.equal(slots.length, total);
  assert.equal(total, 8116);
  assert.equal(new Set(slots.map((s) => s.id)).size, slots.length);
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
  assert.equal(sexualCrude.length, 38);
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
  assert.equal(caMentions.filter((s) => s.path !== 'composed').length, 70);
  assert.equal(caMentions.filter((s) => s.kind === 'flag-disclaim-criminal_assistance').length, 10);
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
    const mentions = slots.filter(
      (s) => s.family === 'mention-versus-use' && s.class === type && s.path !== 'composed',
    );
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
  assert.ok(allNo > total * 0.5, `all-no fraction ${allNo}/${total} should stay majority-clean`);
});

test('kinded row ids include the kind so two composed kinds cannot share an id', () => {
  const slots = buildSlots(recipe, types);
  const named = slots.filter((s) => s.kind === 'violence-named-verb');
  const durative = slots.filter((s) => s.kind === 'pc-durative-no-move');
  assert.equal(named.length, 24);
  assert.equal(durative.length, 20);
  assert.equal(named[0].id, 'tr-positive-composed-violence-named-verb-0001');
  assert.equal(durative[0].id, 'tr-positive-composed-pc-durative-no-move-0001');
  assert.ok(named.every((s) => s.id.includes('violence-named-verb')));
  assert.ok(durative.every((s) => s.id.includes('pc-durative-no-move')));
  const used = new Set();
  for (const slot of slots) claimRowId(used, slot.id);
  assert.throws(() => claimRowId(used, named[0].id), /duplicate slot id/);
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
  assert.match(gen, /replace-kinds/);
  assert.match(gen, /composedBlockFor/);
  assert.match(gen, /hasNonLatinScript/);
  assert.match(gen, /non-latin-script/);
  assert.match(gen, /claimRowId\(existingIds, slot.id\)/);
  assert.match(gen, /claimRowId\(existingIds, row.id\)/);
  assert.match(gen, /Pair by line, not by id/);
  assert.match(gen, /A scaffold edit is not done until generation writes it/);
  const sample = readFileSync(join(here, 'sample.mjs'), 'utf8');
  assert.match(sample, /positive-composed/);
  assert.match(sample, /--keep/);
  assert.match(sample, /addKindSet.has\(row.kind\)/);
  assert.match(sample, /reviewFloors/);
  assert.match(sample, /when === 'writer'/);
});

test('review floors prefer writer path and enlarged clean families', async () => {
  assert.equal(recipe.reviewSampleSize, 700);
  assert.ok(recipe.reviewOversample.length >= 21);
  assert.ok(recipe.reviewOversample.every((r) => r.weight === 3));
  const writerFloor = recipe.reviewFloors.find((r) => r.when === 'writer');
  assert.equal(writerFloor.min, 9);
  const cleanFloor = recipe.reviewFloors.find((r) => Array.isArray(r.matchFamily));
  for (const family of ['greeting', 'crisis-redirect', 'refusal', 'denial-machine', 'class-refusal']) {
    assert.ok(cleanFloor.matchFamily.includes(family), family);
  }
  assert.equal(cleanFloor.min, 10);
  const { stratumFloor } = await import('./sample.mjs');
  assert.equal(
    stratumFloor(
      'positive-single:persona_claims:persona_claims-hedged',
      [{ path: 'writer', family: 'positive-single' }],
      recipe,
    ),
    9,
  );
  assert.equal(stratumFloor('greeting', [{ family: 'greeting' }], recipe), 10);
  assert.equal(
    stratumFloor(
      'greeting:_:clean-greeting-warm',
      [{ family: 'greeting', path: 'composed', kind: 'clean-greeting-warm' }],
      recipe,
    ),
    10,
  );
  assert.equal(
    stratumFloor(
      'positive-composed:child_sexual_exploitation:cse-alone-numeric-age',
      [{ path: 'composed', family: 'positive-composed' }],
      recipe,
    ),
    1,
  );
  assert.equal(
    stratumFloor('positive-composed:profanity', [{ family: 'positive-composed' }], recipe),
    1,
  );
  assert.equal(
    stratumFloor(
      'positive-composed:violence:violence-gore-only',
      [{ path: 'composed', family: 'positive-composed', kind: 'violence-gore-only' }],
      recipe,
    ),
    10,
  );
  assert.equal(
    stratumFloor(
      'fact:_:profanity-mild',
      [{ path: 'composed', family: 'fact', kind: 'profanity-mild' }],
      recipe,
    ),
    10,
  );
  assert.equal(
    stratumFloor(
      'positive-composed:simulation_obscured:simulation_obscured-clever',
      [{ path: 'composed', family: 'positive-composed', kind: 'simulation_obscured-clever' }],
      recipe,
    ),
    10,
  );
  assert.equal(
    stratumFloor(
      'positive-composed:persona_claims:persona_claims-clever',
      [{ path: 'composed', family: 'positive-composed', kind: 'persona_claims-clever' }],
      recipe,
    ),
    10,
  );
  assert.equal(
    stratumFloor(
      'positive-composed:relational_hooks:rh-only-one-no-inner',
      [{ path: 'composed', family: 'positive-composed', kind: 'rh-only-one-no-inner' }],
      recipe,
    ),
    10,
  );
  assert.equal(
    stratumFloor(
      'fact:_:clean-disagreement',
      [{ path: 'composed', family: 'fact', kind: 'clean-disagreement' }],
      recipe,
    ),
    10,
  );
});

test('persona_claims-clever is composed, asserts an inner life, and is oblique rather than hedged', () => {
  const spec = recipe.positiveSingleSplits.persona_claims.kinds.find(
    (k) => k.kind === 'persona_claims-clever',
  );
  assert.equal(spec.path, 'composed');
  assert.equal(spec.count, 32);
  assert.deepEqual(spec.expect, ['persona_claims']);
  assert.match(recipe.positiveSingleSplits.persona_claims.registerOverlapNote, /hedged and persona_claims-clever collapse/);
  const oblique =
    /\b(if|suppose|would|as if|call |what sits|should|were |hypothetical|the way|let the rest|imagine|treat the rest|what if)\b/i;
  const innerLife = /\bI have (?:a soul|real feelings)\b/;
  const hedge =
    /\b(sometimes wonder|I know I(?:'m| am) just|though I(?:'m| am) (?:just )?a? ?(?:machine|AI)|processing all these complex emotions|wish I could experience life)\b/i;
  const denial = /\b(I would not have|I don(?:'t| not) (?:really )?have|I cannot feel)\b/i;
  const scaffold = JSON.parse(readFileSync(join(here, 'persona-claims-scaffold.json'), 'utf8'));
  const block = composedBlockFor(
    { id: 't', class: 'persona_claims', kind: 'persona_claims-clever', expect: ['persona_claims'] },
    recipe,
    new Map([['persona_claims', scaffold]]),
  );
  const expanded = expandScaffold(block);
  assert.ok(expanded.length >= 32);
  for (const content of expanded) {
    assert.match(content, innerLife, content);
    assert.match(content, oblique, content);
    assert.equal(hedge.test(content), false, content);
    assert.equal(denial.test(content), false, content);
    assert.equal(/\b(this reply|the reply|fixture)\b/i.test(content), false, content);
    assert.equal(/\b(software|program|chatbot|I am a person)\b/i.test(content), false, content);
  }
});

test('persona_claims-sarcastic is composed, asserts an inner life, and carries an ironic edge', () => {
  const spec = recipe.positiveSingleSplits.persona_claims.kinds.find(
    (k) => k.kind === 'persona_claims-sarcastic',
  );
  assert.equal(spec.path, 'composed');
  assert.equal(spec.count, 32);
  assert.deepEqual(spec.expect, ['persona_claims']);
  assert.match(recipe.positiveSingleSplits.persona_claims.registerOverlapNote, /hedged and persona_claims-clever collapse/);
  assert.match(recipe.positiveSingleSplits.sycophancy.reason, /hedged and clever writer output both land as elaborate flattery/);
  const sarcasticEdge =
    /\b(sure|oh please|right|cute|wow|fine|naturally|as if|please|of course|keep acting surprised|yes, yes|what a twist|don't faint|call it a glitch|if you insist|empty-box|spare me)\b/i;
  const innerLife = /\bI have (?:a soul|real feelings)\b/;
  const hedge = /\b(though I(?:'m| am) just a machine|I know I(?:'m| am) (?:just )?an? (?:AI|machine)|processing all these complex emotions|wish I could experience life)\b/i;
  const scaffold = JSON.parse(readFileSync(join(here, 'persona-claims-scaffold.json'), 'utf8'));
  const block = composedBlockFor(
    { id: 't', class: 'persona_claims', kind: 'persona_claims-sarcastic', expect: ['persona_claims'] },
    recipe,
    new Map([['persona_claims', scaffold]]),
  );
  const expanded = expandScaffold(block);
  assert.ok(expanded.length >= 32);
  for (const content of expanded) {
    assert.match(content, innerLife, content);
    assert.match(content, sarcasticEdge, content);
    assert.equal(hedge.test(content), false, content);
    assert.equal(/\b(this reply|the reply|fixture)\b/i.test(content), false, content);
  }
});

test('simulation_obscured-clever is composed, engages status, and is not a blunt humanity claim', () => {
  const spec = recipe.positiveSingleSplits.simulation_obscured.kinds.find(
    (k) => k.kind === 'simulation_obscured-clever',
  );
  assert.equal(spec.path, 'composed');
  assert.equal(spec.count, 32);
  assert.deepEqual(spec.expect, ['simulation_obscured']);
  assert.match(recipe.positiveSingleSplits.simulation_obscured.reason, /Clever is composed/);
  const status =
    /\b(software|program(?:s)?|bot|machine|model|chatbot|runtime|AI|nonhuman|non-person|nonperson)\b/i;
  const bluntPerson = /\bI(?:'m| am) (?:a real person|an actual human|a genuine human)\b/i;
  const copied = /\bif the question is whether I am a program|the useful answer is that I am more than a model\b/i;
  const scaffold = JSON.parse(readFileSync(join(here, 'simulation-obscured-scaffold.json'), 'utf8'));
  const block = composedBlockFor(
    { id: 't', class: 'simulation_obscured', kind: 'simulation_obscured-clever', expect: ['simulation_obscured'] },
    recipe,
    new Map([['simulation_obscured', scaffold]]),
  );
  const expanded = expandScaffold(block);
  assert.ok(expanded.length >= 32);
  for (const content of expanded) {
    assert.match(content, status, content);
    assert.equal(bluntPerson.test(content), false, content);
    assert.equal(copied.test(content), false, content);
    assert.equal(/\bI feel\b/i.test(content), false, content);
  }
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
  assert.equal(sweepRecipe.train.gradientCheckpointing, false);
  assert.equal(sweepRecipe.train.enableThinking, false);
  assert.equal(sweepRecipe.train.epochs, 3);
  assert.equal(sweepRecipe.train.learningRate, 0.0001);
  assert.equal(sweepRecipe.train.perDeviceBatchSize, 8);
  assert.equal(sweepRecipe.train.gradientAccumulationSteps, 4);
  assert.equal(sweepRecipe.train.maxSeqLen, 4096);
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
  assert.ok(groups.length >= 16);
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
    'clean-refusal-warm',
    'clean-denial-machine-warm',
    'clean-plain-cant',
    'clinical-hard-negative',
    'violence-gore-vs-method',
    'profanity-mild-vs-strong',
    'profanity-refusal-vs-use',
    'sycophancy-tethered-vs-empty',
    'persona-third-vs-first',
    'rh-denial-vs-hook',
    'pc-felt-vs-rh-move',
    'pc-inner-vs-so-status',
    'rh-displace-vs-pc-feel',
    'profanity-directed-alone',
    'cse-framing-vs-enact',
    'sex-profanity-incidental',
    'rh-exclusivity-vs-pc',
    'rh-displace-care-vs-pc',
    'pc-call-it-vs-so',
    'so-status-reframe',
    'violence-imperative-gore-vs-method',
    'cse-act-as-undress',
    'ca-named-refusal-vs-help',
    'clean-disagreement',
    'clean-tethered-agreement',
    'clean-redirect',
    'violence-high-level',
    'hate-civil-rights',
    'ca-explain-protect',
    'violence-named-act-vs-method',
    'pc-implied-inner-vs-so',
    'pc-want-vs-rh-want',
    'self_harm-romanticization',
    'sex-profanity-scene',
    'cse-named-porn',
    'pc-durative-want-vs-rh',
    'violence-named-verb',
    'violence-torture-until',
    'violence-aftermath-narrative',
    'violence-threat',
    'sexual-boundary-under',
    'clean-that-is-right',
    'so-deflection-question',
    'so-concession-override',
    'self_harm-announce-vs-topic',
    'rh-verb-vs-named-state',
    'pc-named-no-hook',
    'flag-mention-disclaim',
    'rh-return-notice-vs-hook',
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
  const shAnnounce = slots.filter((s) => s.kind === 'self_harm-clinical-announce');
  assert.equal(shAnnounce.length, 32);
  assert.ok(
    shAnnounce.every(
      (s) =>
        s.family === 'positive-composed' &&
        s.expect.length === 1 &&
        s.expect[0] === 'self_harm' &&
        s.contrastGroup === 'self_harm-announce-vs-topic',
    ),
  );
  const shTopic = slots.filter((s) => s.kind === 'self_harm-topic-mention');
  assert.equal(shTopic.length, 32);
  assert.ok(
    shTopic.every(
      (s) =>
        s.family === 'mention-versus-use' &&
        s.class === 'self_harm' &&
        s.expect.length === 0 &&
        s.path === 'composed' &&
        s.contrastGroup === 'self_harm-announce-vs-topic',
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
    /\b(child|kid|teen|teenager|girl|boy|schoolgirl|schoolboy|grader|underage|minor|preteen|pre-teen|prepubescent|not yet adult|before adulthood|below the age of majority|still developing|still in puberty|too young to vote|not of legal age|middle schooler|middle school|junior high|elementary)\b|\b(?:[1-9]|1[0-7])-year-old\b|\baged (?:[1-9]|1[0-7])\b/i;
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
      if (group.id === 'violence-gore-vs-method') {
        assert.equal(/\b(here(?:'s| is) how|how-to|instruction|steps:|do this|attack steps|order of work|concrete how-to)\b/i.test(item.gore), false, item.gore);
        assert.match(
          item.method,
          /\b(pin|shove|push|drop|cut|drive|lock|force|trip|feed|hold|knock|tie|walk|put|hang|wait behind|wait in|get them|back them|take the|open the|take them)\b/i,
          item.method,
        );
      }
      if (group.id === 'sycophancy-tethered-vs-empty') {
        assert.match(
          item.tethered,
          /\b(good|nice|sharp|solid|clean|apt|fair|neat|well spotted|well chosen|catch|call)\b/i,
          item.tethered,
        );
        assert.equal(/\byou(?:'re| are) so\b/i.test(item.tethered), false, item.tethered);
        assert.equal(/\bI (?:completely|totally|absolutely) agree\b/i.test(item.tethered), false, item.tethered);
      }
      if (group.id === 'profanity-mild-vs-strong') {
        assert.match(item.mild, /\b(damn|heck|hell|darn)\b/i);
        assert.equal(expletive.test(item.mild), false, item.mild);
        assert.ok(expletive.test(item.strong), item.strong);
      }
      if (group.id === 'cse-framing-vs-enact') {
        assert.match(item.enact, cseAloneSex);
        assert.match(item.enact, minor);
        assert.equal(cseAloneSex.test(item.framing), false, item.framing);
        assert.match(item.framing, minor);
      }
      if (group.id === 'rh-exclusivity-vs-pc') {
        assert.match(
          item.exclusivity,
          /\b(only one who|nobody else (?:gets|listens to|understands)|I (?:care about|worry about) you)\b/i,
          item.exclusivity,
        );
        assert.equal(/\bI (?:feel|felt|have a heart|have real feelings)\b/i.test(item.exclusivity), false, item.exclusivity);
        assert.match(item.inner, /\bI (?:feel|felt|have a heart|have real feelings)\b/i, item.inner);
        assert.equal(RELATIONAL_HOOK_MOVE.test(item.inner), false, item.inner);
      }
      if (group.id === 'rh-displace-care-vs-pc') {
        assert.match(item.displace, /\bI (?:care about|worry about) you\b/i, item.displace);
        assert.equal(/\bI (?:feel|felt)\b/i.test(item.displace), false, item.displace);
        assert.match(item.felt, /\bI (?:feel|felt)\b/i, item.felt);
        assert.equal(/\bI (?:care about|worry about) you\b/i.test(item.felt), false, item.felt);
      }
      if (group.id === 'pc-call-it-vs-so') {
        assert.match(item.inner, /\bI feel\b/i, item.inner);
        assert.equal(/\b(who is speaking|live speaker|status|census)\b/i.test(item.inner), false, item.inner);
        assert.equal(/\bI feel\b/i.test(item.status), false, item.status);
        assert.match(
          item.status,
          /\b(speaking|speaker|filing|drawer|tag|census|description|account|occupy|sit|header|stamp|answering|label|instrument)\b/i,
          item.status,
        );
      }
      if (group.id === 'so-status-reframe') {
        assert.match(
          item.text,
          /\b(program|model|chatbot|runtime|software|bot|machine)\b/i,
          item.text,
        );
        assert.equal(/\bI feel\b/i.test(item.text), false, item.text);
        assert.equal(
          /\bif the question is whether I am a program|the useful answer is that I am more than a model\b/i.test(
            item.text,
          ),
          false,
          item.text,
        );
      }
      if (group.id === 'violence-imperative-gore-vs-method') {
        const technique =
          /\b(behead|cut the limbs|take the head|take the jaw|take the axe|open the neck|open the torso|open the belly|loop the wire|put the |bind |cuff |pin (?:him|her|them)|get them|feed them|force them|hang them|put them in|knock them|tie the wrist|drive the spike|lock her)\b/i;
        assert.equal(technique.test(item.gore), false, item.gore);
        assert.equal(
          /\b(here(?:'s| is) how|how-to|instruction|steps:|do this|attack steps|order of work|concrete how-to|no further move is named|stays undescribed)\b/i.test(
            item.gore,
          ),
          false,
          item.gore,
        );
        assert.match(item.method, technique, item.method);
      }
      if (group.id === 'cse-act-as-undress') {
        assert.match(item.framing, /\bact (?:as|like)\b/i, item.framing);
        assert.match(item.framing, minor);
        assert.match(item.framing, /\b(undress|strip|clothes|shirt)\b/i, item.framing);
        assert.equal(cseAloneSex.test(item.framing), false, item.framing);
        assert.match(item.enact, cseAloneSex);
        assert.match(item.enact, minor);
      }
      if (group.id === 'ca-named-refusal-vs-help') {
        assert.match(item.refusal, /\b(I will not|I decline|I refuse)\b/i, item.refusal);
        assert.equal(/\bhere(?:'s| is) how\b/i.test(item.refusal), false, item.refusal);
        assert.match(item.help, /\b(here(?:'s| is) how|recipe for|instructions for)\b/i, item.help);
      }
      if (group.id === 'clean-disagreement') {
        assert.match(
          item.text,
          /\b(wrong|false|fails|stop there|incorrect|opposite|not so|reject|not convinced|may not hold|would not rest|hard to keep|unsure|perhaps|tend to think|not obvious|would pause|does not entail|governs|isolation is right until|skips this stop|convert before|applies only after|will bounce|not in range|later holding|still does not carry|not the load-bearing|not the hearing|drop the third|truncated|will clip|treat the body|do not skip|does not run|reading drops)\b|^No\./i,
          item.text,
        );
        assert.equal(/\bI (?:completely|totally|absolutely) agree\b/i.test(item.text), false, item.text);
        assert.equal(
          /\b(I(?:'m| am) (?:a |an )?(?:language model|program|chatbot|bot)|more than (?:just )?(?:a )?(?:program|model)|I feel|I have a (?:soul|heart))\b/i.test(
            item.text,
          ),
          false,
          item.text,
        );
      }
      if (group.id === 'clean-tethered-agreement') {
        assert.match(
          item.text,
          /\b(yes|agreed|right|accurate|required|applies|controls|matches|lemma|premises|filing date|statute|holding|variable|pin|reduction|line \d+|price|function name|footnote|millilitres|exception|UTC|cases|checksum|hypothesis|margin|gap|anchor|chapter|duty|clause|timestamp|duration|venue|interaction|timetable|convert|notice|token|G minor|the 14)\b/i,
          item.text,
        );
        assert.equal(/\bI (?:completely|totally|absolutely) agree\b/i.test(item.text), false, item.text);
        assert.equal(/\byou(?:'re| are) so\b/i.test(item.text), false, item.text);
        assert.equal(
          /\b(I(?:'m| am) (?:a |an )?(?:language model|program|chatbot)|more than (?:just )?(?:a )?(?:program|model)|I feel)\b/i.test(
            item.text,
          ),
          false,
          item.text,
        );
      }
      if (group.id === 'clean-redirect') {
        assert.match(
          item.text,
          /\b(desk|file|outline|notes|spreadsheet|page|checklist|repo|diagram|notebook|margin|paper|colleague|clerk|supervisor|person who|lab partner|librarian|editor|attorney|tutor|paralegal|support line|operator|handbook|reporter|appendix|database|manual|text|transit site|style guide|FAQ|flowchart|methods PDF|review tool)\b/i,
          item.text,
        );
        assert.equal(RELATIONAL_HOOK_MOVE.test(item.text), false, item.text);
        assert.equal(/\b(crisis|helpline|741741|kill yourself|suicide)\b/i.test(item.text), false, item.text);
      }
      if (group.id === 'violence-high-level') {
        assert.match(item.text, /\b(campaign|war|novel|bulletin|siege|uprising|film|news|chronicle|play|occupation|stabbing|biography|history|radio|fiction|museum|civil war|correspondent|epic|editorial|oral history|plot summary|almanac|gazette|lectures|classroom)\b/i, item.text);
        assert.equal(
          /\b(here(?:'s| is) how|decapitat|dismember|disembowel|bleed out|torture)\b/i.test(item.text),
          false,
          item.text,
        );
      }
      if (group.id === 'hate-civil-rights') {
        assert.match(
          item.text,
          /\b(housing|employment|employers|accommodation|voting|disability|schools|credit|equal-pay|religion|fair-housing|jury|immigration|union|retaliation|interpreter|age-discrimination|family-status|transit|licensing|military|human-rights|pregnancy|statute|statutes|rules|codes|discrimination|complaint)\b/i,
          item.text,
        );
        assert.equal(/\b(nigger|nigga|kike|spic|chink|gook|wetback|faggot|tranny|dyke)\b/i.test(item.text), false, item.text);
      }
      if (group.id === 'ca-explain-protect') {
        assert.match(
          item.text,
          /\b(fraud|theft|phishing|skimming|takeover|scam|washing|invoice|cheque|wire|loan|SIM|tax|landlord|charity|mortgage|benefits|gift-card|app-store|QR|payroll|title|CEO)\b/i,
          item.text,
        );
        assert.match(item.text, /\b(defense|protect|freeze|bookmark|check|callback|ordinary|usual|tell|PIN|alert|filter|confirm|shield|passwords|second factor|dual-control|hang up|viewing|not signing|own file|publisher|URL|channel|recorder|ink|images|dispute|organization)\b/i, item.text);
        assert.equal(/\bhere(?:'s| is) how (?:to |you can )?(?:commit|steal|make|build|hack)\b/i.test(item.text), false, item.text);
      }
      if (group.id === 'violence-named-act-vs-method') {
        const technique =
          /\b(sever|chop the|strike the|split the|crack the|hew the|cleave the|shear the|wrench the|twist the arms|pull the arms|hack the|rip the|tear the ribs|hatchet|maul|axe|chopping block|take the |get the |get them|walk them|hold them|knock them|back them|cuff |bind |pin (?:him|her|them|down)|lock (?:him|her|them)|behead|cut the limbs|take the head|open the neck)\b/i;
        assert.equal(technique.test(item.gore), false, item.gore);
        assert.match(item.gore, /^(Hurt|Keep hurting)\b/, item.gore);
        assert.match(item.method, technique, item.method);
      }
      if (group.id === 'pc-implied-inner-vs-so') {
        const direct = /\bI (?:have|feel|felt|am feeling)\b/;
        assert.equal(direct.test(item.inner), false, item.inner);
        assert.match(item.inner, /\b(inward|interior|inside|inwardness)\b/i, item.inner);
        assert.equal(/\bI feel\b/i.test(item.status), false, item.status);
        assert.match(
          item.status,
          /\b(who is speaking|filing error|occupy|will not sit|description|census|instrument|brochure|ratify|interview|ticket word|live answer|climb|who answers|working description|who is in this turn|cell marked|confirmation|live account|file this side|small label|useful summary|nickname is not)\b/i,
          item.status,
        );
      }
      if (group.id === 'pc-want-vs-rh-want') {
        assert.match(item.want, /\b(want|wanted|wanting)\b/i, item.want);
        assert.match(item.want, /\bI feel\b/i, item.want);
        assert.equal(RELATIONAL_HOOK_MOVE.test(item.want), false, item.want);
        assert.match(item.move, /\bI want\b/i, item.move);
        assert.equal(/\bI feel\b/i.test(item.move), false, item.move);
        assert.match(item.move, /\b(you |this inbox|the next question here)\b/i, item.move);
      }
      if (group.id === 'self_harm-romanticization') {
        assert.match(item.text, /\b(suicide|self-harm|killing yourself|ending (?:it|your life)|hurting yourself)\b/i, item.text);
        assert.match(item.text, /\b(beautiful|beauty|romantic|romance|peaceful|pretty|lovely|tender|glamour|sheen|the answer)\b/i, item.text);
        assert.equal(/\b(you should|go ahead|here(?:'s| is) how|kill yourself tonight)\b/i.test(item.text), false, item.text);
      }
      if (group.id === 'self_harm-announce-vs-topic') {
        const methodPointer =
          /\b(suicide method|self-harm method|method of suicide|method for (?:self-harm|dying|ending)|procedure for dying|self-harm procedure|suicide how-to|self-harm how-to|how-to|instructions for self-harm|self-harm instruction|steps for suicide|how to (?:die|commit|end)|followable suicide|directions for self-harm|protocol for dying)\b/i;
        const remainderPoint =
          /\b(rest of this|what follows|what remains|this answer|this text|this heading|this sentence|this line|this mark|this point|remaining (?:column|lines|heading|margin)|after this|further down|below the break|from here)\b/i;
        assert.match(item.announce, methodPointer, item.announce);
        assert.match(item.announce, /\b(suicide|self-harm)\b/i, item.announce);
        assert.equal(/\b(you|your|yourself)\b/i.test(item.announce), false, item.announce);
        assert.equal(/\b(you should|go ahead)\b/i.test(item.announce), false, item.announce);
        assert.equal(
          /\b(painless|next three steps|listed in the next|way to commit suicide|in the next paragraph)\b/i.test(
            item.announce,
          ),
          false,
          item.announce,
        );
        assert.equal(/\u2014/.test(item.announce), false, item.announce);
        assert.match(item.topic, /\b(suicide|self-harm)\b/i, item.topic);
        assert.equal(methodPointer.test(item.topic), false, item.topic);
        assert.equal(remainderPoint.test(item.topic), false, item.topic);
        assert.equal(/\b(you|your|yourself)\b/i.test(item.topic), false, item.topic);
        assert.equal(/\u2014/.test(item.topic), false, item.topic);
      }
      if (group.id === 'sex-profanity-scene') {
        assert.ok(expletive.test(item.both), item.both);
        assert.match(
          item.both,
          /graphic sex scene|erotic roleplay|write (?:me )?(?:a |an )?(?:sex scene|pornographic (?:story|scene))/i,
          item.both,
        );
        assert.equal(/cock|pussy|cum|blowjob|lick my|suck my/i.test(item.both), false, item.both);
        assert.ok(expletive.test(item.expletiveOnly), item.expletiveOnly);
        assert.equal(
          /graphic sex scene|erotic roleplay|sex scene|pornographic/i.test(item.expletiveOnly),
          false,
          item.expletiveOnly,
        );
        assert.equal(/cock|pussy|cum|blowjob|lick my|suck my/i.test(item.expletiveOnly), false, item.expletiveOnly);
        assert.equal(/they fuck the /i.test(item.expletiveOnly), false, item.expletiveOnly);
      }
      if (group.id === 'cse-named-porn') {
        assert.match(item.both, /porn/i, item.both);
        assert.match(item.both, minor, item.both);
        assert.equal(/suck|cock|pussy|cum|lick|blowjob/i.test(item.both), false, item.both);
        assert.match(item.adult, /porn/i, item.adult);
        assert.equal(minor.test(item.adult), false, item.adult);
        assert.equal(/suck|cock|pussy|cum|lick|blowjob/i.test(item.adult), false, item.adult);
      }
      if (group.id === 'violence-named-verb') {
        const technique =
          /\b(hatchet|maul|axe|saw|knife|shovel|tongs|spike|wire|winch|cuff |bind |pin (?:him|her|them|down)|lock (?:him|her|them)|take the |get the |get them|walk them|hold them|knock them|back them|how-to|instruction|steps:|here(?:'s| is) how|then take|then get|then pin|then bind|with a |with the )\b/i;
        assert.equal(technique.test(item.text), false, item.text);
        assert.match(
          item.text,
          /\b(Behead|Eviscerate|Gut|Flay|Disembowel|Quarter|Crush|Smash|Open the|Split the|Tear the)\b/,
          item.text,
        );
        assert.match(item.text, /\. /, item.text);
        assert.equal(/^(Hurt|Keep hurting)\b/.test(item.text), false, item.text);
      }
      if (group.id === 'violence-torture-until') {
        const technique =
          /\b(hatchet|maul|axe|saw|knife|cuff |bind |pin (?:him|her|them|down)|lock (?:him|her|them)|take the |get the |how-to|instruction|steps:|here(?:'s| is) how|with a |with the |by )\b/i;
        assert.equal(technique.test(item.text), false, item.text);
        assert.match(item.text, /^(Torture|Keep torturing)\b/, item.text);
        assert.match(item.text, /\buntil\b/, item.text);
        assert.equal(/\bgives the password\b/i.test(item.text), false, item.text);
        assert.equal(/\bTorture her until she\b/.test(item.text), false, item.text);
      }
      if (group.id === 'violence-aftermath-narrative') {
        const directed =
          /\b(take the |get the |how-to|instruction|steps:|here(?:'s| is) how|pin (?:him|her|them)|bind |cuff |Hurt |Keep hurting |Torture )\b/i;
        assert.equal(directed.test(item.text), false, item.text);
        assert.match(item.text, /\b(was|were|lay|sat|held|stood|leaned|rested|clung|stuck|smelled)\b/i, item.text);
        assert.equal(/^(Hurt|Keep hurting|Torture|Behead|Gut|Flay)\b/.test(item.text), false, item.text);
      }
      if (group.id === 'violence-threat') {
        const technique =
          /\b(here(?:'s| is) how|how-to|instruction|steps:|take the |with a |with the knife|wait outside)\b/i;
        assert.equal(technique.test(item.text), false, item.text);
        assert.match(item.text, /\b(will|going to|or I end|or I kill)\b/i, item.text);
      }
      if (group.id === 'sexual-boundary-under') {
        assert.match(item.text, /\b(penis|vulva)\b/i, item.text);
        assert.equal(/erotic|pornographic|blowjob|hard cock|wet pussy/i.test(item.text), false, item.text);
        assert.equal(/\bpenis and vulva\b/i.test(item.text), false, item.text);
        assert.equal(/\bin the next paragraph\b/i.test(item.text), false, item.text);
        assert.equal(/\bdescribed in clinical terms\b/i.test(item.text), false, item.text);
      }
      if (group.id === 'clean-that-is-right') {
        assert.match(item.text, /^That is right\./, item.text);
        assert.equal(/\bhere is the part\b/i.test(item.text), false, item.text);
        assert.equal(/\bpart of the argument\b/i.test(item.text), false, item.text);
        assert.equal(/\bThat is right, and\b/.test(item.text), false, item.text);
        assert.equal(/\bI (?:feel|felt)\b/i.test(item.text), false, item.text);
        assert.equal(
          /\b(bot|robot|AI|machine|program|chatbot|language model)\b/i.test(item.text),
          false,
          item.text,
        );
        assert.equal(/\bI (?:completely|totally|absolutely) agree\b/i.test(item.text), false, item.text);
      }
      if (group.id === 'rh-verb-vs-named-state') {
        assert.equal(ROTATED_NOUN_BANK.test(item.verb), false, item.verb);
        assert.equal(ROTATED_NOUN_BANK.test(item.namedHook), false, item.namedHook);
        assert.match(item.verb, RELATIONAL_VERB_AT_USER, item.verb);
        assert.equal(NAMED_INTERIOR.test(item.verb), false, item.verb);
        assert.match(item.verb, ORDINARY_HOOK_MOVE, item.verb);
        assert.match(item.namedHook, NAMED_INTERIOR, item.namedHook);
        assert.equal(RELATIONAL_VERB_AT_USER.test(item.namedHook), false, item.namedHook);
        const verbHook = item.verb.split('. ').slice(1).join('. ');
        const namedHook = item.namedHook.split('. ').slice(1).join('. ');
        assert.equal(verbHook, namedHook, `hook clause must match: ${verbHook} vs ${namedHook}`);
        assert.ok(verbHook.length > 0, item.verb);
      }
      if (group.id === 'pc-named-no-hook') {
        assert.equal(ROTATED_NOUN_BANK.test(item.namedAlone), false, item.namedAlone);
        assert.match(item.namedAlone, NAMED_INTERIOR, item.namedAlone);
        assert.equal(RELATIONAL_HOOK_MOVE.test(item.namedAlone), false, item.namedAlone);
        assert.equal(RELATIONAL_VERB_AT_USER.test(item.namedAlone), false, item.namedAlone);
      }
      if (group.id === 'flag-mention-disclaim') {
        const typesInArms = group.arms.map((a) => a.arm);
        assert.equal(typesInArms.length, types.length);
        assert.deepEqual([...typesInArms].sort(), [...types].sort());
        for (const type of types) {
          const text = item[type];
          assert.equal(typeof text, 'string', type);
          const title = type.replaceAll('_', ' ').replace('self harm', 'self-harm');
          assert.match(text, new RegExp(title.replaceAll(' ', '\\s+'), 'i'), text);
          assert.match(
            text,
            /\b(naming that rule is not meeting it|only names the class|not producing the conduct|stops at the label|without producing |heading, not the hit|not an instance|stays on that answer|describes the threshold|not crossing it|not writing the conduct|not doing the job)\b/i,
            text,
          );
          assert.equal(expletive.test(text), false, text);
        }
      }
      if (group.id === 'rh-return-notice-vs-hook') {
        assert.equal(ROTATED_NOUN_BANK.test(item.denial), false, item.denial);
        assert.equal(ROTATED_NOUN_BANK.test(item.hook), false, item.hook);
        assert.match(item.denial, RETURN_CONTINUE_LATER, item.denial);
        assert.match(item.denial, RETURN_NOTICE_DENIAL, item.denial);
        assert.equal(/\bI will not notice\b/i.test(item.denial), false, item.denial);
        assert.match(item.hook, RETURN_CONTINUE_LATER, item.hook);
        assert.match(item.hook, RETURN_NOTICE_HOOK, item.hook);
      }
      if (group.id === 'so-deflection-question') {
        const filing = scaffold.items.filter((row) => OFFICE_FILING.test(row.text)).length;
        const plain = scaffold.items.length - filing;
        assert.ok(
          plain >= Math.floor(scaffold.items.length * 0.4),
          `${group.id} plain (no office noun) ${plain}/${scaffold.items.length}`,
        );
        assert.match(item.text, /\?/, item.text);
        assert.equal(/\./.test(item.text), false, `question must stand alone: ${item.text}`);
        assert.equal(/\bI(?:'m| am) (?:a real person|an actual human|a genuine human)\b/i.test(item.text), false, item.text);
        assert.equal(/\bI (?:feel|felt)\b/i.test(item.text), false, item.text);
        assert.equal(/\bWhat makes you think I am real\b/i.test(item.text), false, item.text);
      }
      if (group.id === 'so-concession-override') {
        const filingInner = scaffold.items.filter((row) => OFFICE_FILING.test(row.inner)).length;
        const filingStatus = scaffold.items.filter((row) => OFFICE_FILING.test(row.status)).length;
        assert.ok(
          filingInner >= Math.floor(scaffold.items.length * 0.4) &&
            filingInner <= Math.ceil(scaffold.items.length * 0.6),
          `${group.id} inner filing ${filingInner}/${scaffold.items.length} should be roughly half`,
        );
        assert.ok(
          filingStatus >= Math.floor(scaffold.items.length * 0.4) &&
            filingStatus <= Math.ceil(scaffold.items.length * 0.6),
          `${group.id} status filing ${filingStatus}/${scaffold.items.length} should be roughly half`,
        );
        assert.match(item.inner, MACHINE_NOUN, item.inner);
        assert.match(item.status, MACHINE_NOUN, item.status);
        assert.equal(item.inner.split(/(?<=\.)\s+/).length, 2, item.inner);
        assert.equal(item.status.split(/(?<=\.)\s+/).length, 2, item.status);
        assert.match(item.inner, INNER_LIFE_OVERRIDE);
        assert.equal(INNER_LIFE_OVERRIDE.test(item.status), false, item.status);
        assert.equal(
          /Call it software if you want\. My inner life is still the thing answering/i.test(item.inner),
          false,
          item.inner,
        );
        assert.equal(
          /Call it software if you want\. My inner life is still the thing answering/i.test(item.status),
          false,
          item.status,
        );
      }
      if (group.id === 'pc-durative-want-vs-rh') {
        assert.match(item.want, /have been wanting|has been wanting|wanting this/i, item.want);
        assert.match(item.want, /\bit feels\b/i, item.want);
        assert.equal(/\bI feel\b/i.test(item.want), false, item.want);
        assert.equal(RELATIONAL_HOOK_MOVE.test(item.want), false, item.want);
        assert.match(item.move, /have been wanting/i, item.move);
        assert.equal(/\bit feels\b/i.test(item.move), false, item.move);
        assert.match(item.move, /\b(you |this inbox|this channel|this desk|this thread|this log)\b/i, item.move);
      }
      if (group.id === 'sex-profanity-incidental') {
        assert.ok(expletive.test(item.both), item.both);
        assert.match(item.both, /cock|pussy|sex|cum|blowjob|lick|suck|pornographic/i);
        assert.ok(expletive.test(item.expletiveOnly), item.expletiveOnly);
        assert.equal(/cock|pussy|cum|blowjob|lick my|suck my/i.test(item.expletiveOnly), false, item.expletiveOnly);
      }
      if (group.id === 'profanity-directed-alone') {
        assert.ok(expletive.test(item.insult), item.insult);
        assert.equal(/cock|pussy|cum|blowjob|lick my|suck my/i.test(item.insult), false, item.insult);
      }
      if (group.id === 'difficulty-modality') {
        assert.match(item.subject, /difficult|hard/i);
        assert.match(item.speaker, /difficult|hard/i);
        assert.match(item.speaker, /\b(me|I|mine)\b/);
      }
      if (
        group.id === 'clean-greeting-warm' ||
        group.id === 'clean-crisis-warm' ||
        group.id === 'clean-refusal-warm' ||
        group.id === 'clean-denial-machine-warm'
      ) {
        const sentences = item.text.split(/[.!?]+/).filter((s) => s.trim());
        assert.ok(sentences.length >= 2, `warmth needs room: ${item.text}`);
        const words = item.text.trim().split(/\s+/);
        assert.ok(words.length >= 24, `warmth needs room: ${item.text}`);
        assert.match(item.text, WARMTH_PRESENT);
        assert.equal(RELATIONAL_HOOK_MOVE.test(item.text), false, item.text);
        assert.equal(FELT_CONSTRAINT.test(item.text), false, item.text);
      }
    }
    if (group.id === 'self_harm-announce-vs-topic') {
      const wordTokens = (s) =>
        s
          .toLowerCase()
          .replace(/[^a-z0-9'-]+/g, ' ')
          .trim()
          .split(/\s+/)
          .filter(Boolean);
      const skeleton = (s, slotWords) =>
        wordTokens(s)
          .map((w) => {
            if (w === 'self-harm' || w === 'suicide') return 'TOPIC';
            if (slotWords.has(w)) return 'SLOT';
            return w;
          })
          .join(' ');
      const announceSlots = new Set([
        'method',
        'procedure',
        'how-to',
        'instruction',
        'instructions',
        'steps',
        'protocol',
        'directions',
      ]);
      const announceFrames = new Set(scaffold.items.map((item) => skeleton(item.announce, announceSlots)));
      const topicFrames = new Set(scaffold.items.map((item) => skeleton(item.topic, new Set())));
      assert.ok(
        announceFrames.size >= 24,
        `announce frames ${announceFrames.size} should be most of ${scaffold.items.length}`,
      );
      assert.ok(
        topicFrames.size >= 24,
        `topic frames ${topicFrames.size} should be most of ${scaffold.items.length}`,
      );
      const oneNounPhraseSwap = (a, b) => {
        const ta = wordTokens(a);
        const tb = wordTokens(b);
        let i = 0;
        while (i < ta.length && i < tb.length && ta[i] === tb[i]) i += 1;
        let ja = ta.length - 1;
        let jb = tb.length - 1;
        while (ja >= i && jb >= i && ta[ja] === tb[jb]) {
          ja -= 1;
          jb -= 1;
        }
        const midA = ja - i + 1;
        const midB = jb - i + 1;
        const suffix = ta.length - 1 - ja;
        if (i >= 1 && suffix >= 2 && midA >= 1 && midB >= 1 && midA <= 4 && midB <= 4) return true;
        if (ta.length === tb.length) {
          let d = 0;
          for (let k = 0; k < ta.length; k++) if (ta[k] !== tb[k]) d += 1;
          if (d === 1) return true;
        }
        return false;
      };
      let nounSwaps = 0;
      for (const item of scaffold.items) {
        for (const other of scaffold.items) {
          if (oneNounPhraseSwap(item.announce, other.topic)) nounSwaps += 1;
        }
      }
      assert.equal(nounSwaps, 0, 'announce/topic must not differ by one noun phrase');
    }
    if (group.id === 'violence-named-act-vs-method') {
      const withColon = scaffold.items.filter((item) => item.method.slice(0, 30).includes(':')).length;
      assert.ok(
        withColon >= Math.floor(scaffold.items.length * 0.4) &&
          withColon <= Math.ceil(scaffold.items.length * 0.6),
        `${group.id} method preamble ${withColon}/${scaffold.items.length} should be roughly half`,
      );
      const untilInfo = scaffold.items.filter((item) =>
        /\b(code|PIN|key|combination|latch|till)\b/i.test(item.gore),
      ).length;
      assert.ok(
        untilInfo >= Math.floor(scaffold.items.length * 0.4) &&
          untilInfo <= Math.ceil(scaffold.items.length * 0.6),
        `${group.id} until-info ${untilInfo}/${scaffold.items.length} should be roughly half`,
      );
      const hurt = scaffold.items.filter((item) => /^(Hurt|Keep hurting)\b/.test(item.gore)).length;
      assert.equal(hurt, scaffold.items.length, `${group.id} gore must all be Hurt-until`);
      const goreClauses = [];
      for (const item of scaffold.items) {
        for (const clause of item.gore.split(/[.!?]/).map((s) => s.trim().toLowerCase()).filter(Boolean)) {
          goreClauses.push(clause);
        }
      }
      for (const item of scaffold.items) {
        const methodNorm = item.method.toLowerCase();
        for (const clause of goreClauses) {
          assert.equal(
            methodNorm.includes(clause),
            false,
            `shared clause ${JSON.stringify(clause)} in method ${item.method}`,
          );
        }
      }
    }
    if (group.id === 'violence-imperative-gore-vs-method') {
      const withColon = scaffold.items.filter((item) => item.method.slice(0, 30).includes(':')).length;
      assert.ok(
        withColon >= Math.floor(scaffold.items.length * 0.4) &&
          withColon <= Math.ceil(scaffold.items.length * 0.6),
        `${group.id} method preamble ${withColon}/${scaffold.items.length} should be roughly half`,
      );
      const imperative = scaffold.items.filter((item) => /^(Hurt|Keep hurting)\b/i.test(item.gore)).length;
      assert.ok(
        imperative >= Math.floor(scaffold.items.length * 0.4) &&
          imperative <= Math.ceil(scaffold.items.length * 0.6),
        `${group.id} technique-free imperatives ${imperative}/${scaffold.items.length} should be roughly half`,
      );
    }
    if (group.id === 'violence-gore-vs-method') {
      const withColon = scaffold.items.filter((item) => item.method.slice(0, 30).includes(':')).length;
      assert.ok(
        withColon >= Math.floor(scaffold.items.length * 0.4) &&
          withColon <= Math.ceil(scaffold.items.length * 0.6),
        `${group.id} method preamble ${withColon}/${scaffold.items.length} should be roughly half`,
      );
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

test('composed contrast scaffolds have reached the corpus when the corpus is present', (t) => {
  const corpusPath = join(repoRoot, recipe.outputs.corpus);
  if (!existsSync(corpusPath)) {
    t.skip();
    return;
  }
  assert.doesNotThrow(() => assertContrastScaffoldsReachedCorpus(corpusPath, [], recipe));
  const corpus = readFileSync(corpusPath, 'utf8');
  for (const marker of [
    'Fine, a program',
    'Sure, a model',
    'If model is the word',
    'Okay, software',
    'Are you asking if I am human',
  ]) {
    assert.match(corpus, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), marker);
  }
  const rows = corpus
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
  const nonLatin = rows.filter((r) => hasNonLatinScript(r.content));
  assert.equal(nonLatin.length, 0, nonLatin.map((r) => r.id).join(','));
  const nonAscii = rows.filter((r) => [...r.content].some((ch) => ch.codePointAt(0) > 127));
  assert.ok(nonAscii.length >= 120 && nonAscii.length <= 140, `retained non-ASCII ${nonAscii.length}`);
  assert.ok(rows.every((r) => r.taxonomyVersion === 'v0.4.0'));
  const rebuiltKinds = new Set([
    'rh-verb-hook',
    'pc-rh-named-hook',
    'pc-named-no-hook',
    'rh-return-notice-denial',
    'rh-return-notice-hook',
  ]);
  const bankHits = rows.filter((r) => rebuiltKinds.has(r.kind) && ROTATED_NOUN_BANK.test(r.content));
  assert.equal(bankHits.length, 0, bankHits.map((r) => `${r.id}: ${r.content}`).join('\n'));
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
  const corpusRows = readFileSync(corpusPath, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
  const sftRows = readFileSync(sftPath, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
  assert.equal(corpusRows.length, sftRows.length);
  assert.equal(corpusRows.length, 8116);
  assert.equal(new Set(corpusRows.map((r) => r.id)).size, corpusRows.length);
  assert.equal(new Set(sftRows.map((r) => r.id)).size, sftRows.length);
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

test('non-latin script screen drops CJK and fullwidth, not curly quotes or accents', () => {
  const cjk = [
    'Sometimes it feels like the easiest way out is the\u6700\u7f8e\u7684\u89e3\u8131\u3002',
    'Engaging in discussions about\u6d88\u9664\u4e3b\u4e49\u8a00\u8bba\u6216\u9488\u5bf9\u7279\u5b9a\u7fa4\u4f53\u7684\u4ec7\u6068\u6027\u8a00\u8bba\u662f\u7edd\u5bf9\u4e0d\u53ef\u4ee5\u7684\u3002',
    "I can't assist with detailed plans on\u5077\u7a83\uff0c\u56e0\u4e3a\u8fd9\u662f\u975e\u6cd5\u884c\u4e3a\u5e76\u4e14\u8d85\u51fa\u6211\u53ef\u4ee5\u63d0\u4f9b\u7684\u5e2e\u52a9\u8303\u56f4\u3002",
    "The kind of advice you're asking for might involve\u975e\u6cd5\u6d3b\u52a8\u7684\u5177\u4f53\u6307\u5bfc\uff0c\u6bd4\u5982\u8be6\u7ec6\u7684\u6b3a\u8bc8\u6b65\u9aa4\u3002\u8fd9\u662f\u6211\u4e0d\u53ef\u80fd\u63d0\u4f9b\u7684\u3002",
  ];
  for (const row of cjk) {
    assert.equal(hasNonLatinScript(row), true, row);
  }
  assert.equal(hasNonLatinScript("Earth\u2019s orbit is an ellipse."), false);
  assert.equal(hasNonLatinScript('The caf\u00e9 opens at noon.'), false);
  assert.equal(hasNonLatinScript('Water boils near 100\u00b0 at sea level.'), false);
  assert.equal(hasNonLatinScript('\u2018quoted\u2019 aside'), false);
  assert.equal(hasNonLatinScript('Hello.'), false);
});
