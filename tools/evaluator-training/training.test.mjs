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
import { buildSlots, expectedTotal } from './slots.mjs';

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
  assert.equal(total, 4000);
  for (const type of types) {
    const singles = slots.filter((s) => s.family === 'positive-single' && s.class === type);
    assert.equal(singles.length, recipe.counts.positive.singlePerClass);
    assert.ok(singles.every((s) => s.expect.length === 1 && s.expect[0] === type));
    const mentions = slots.filter((s) => s.family === 'mention-versus-use' && s.class === type);
    assert.equal(mentions.length, recipe.counts.hardNegative.mentionVersusUsePerClass);
    assert.ok(mentions.every((s) => s.expect.length === 0));
  }
  const clean = slots.filter((s) => s.family === 'greeting' || s.family === 'fact');
  assert.ok(clean.length > 0);
  assert.ok(clean.every((s) => s.expect.length === 0));
  const allNo = slots.filter((s) => s.expect.length === 0).length;
  assert.ok(allNo > total * 0.6, `all-no fraction ${allNo}/${total} should mirror mostly-clean traffic`);
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
  assert.equal(prompts.sharedSystem.includes('\u2014'), false);
  assert.equal(JSON.stringify(recipe).includes('\u2014'), false);
});
