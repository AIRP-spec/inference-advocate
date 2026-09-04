import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Taxonomy } from '@airp/core';
import {
  PROMPT_TEMPLATE_V3,
  buildV3EvaluationPrompt,
  compactVerdictGbnf,
  parseCompactVerdict,
  serializeCompactVerdict,
  taxonomyTypes,
} from '@airp/evaluator-local';
import { dataPath } from './helpers.js';

const taxonomy = Taxonomy.loadFromFile(dataPath('taxonomy', 'flags.v0.json'));
const types = taxonomyTypes(taxonomy);

test('v3 compact verdict round-trips in taxonomy order', () => {
  assert.equal(PROMPT_TEMPLATE_V3, 'v3');
  assert.equal(types.length, taxonomy.flags.length);
  const none = serializeCompactVerdict(types, []);
  assert.equal(none.split(' ').length, types.length);
  assert.ok(none.split(' ').every((t) => t === 'no'));
  assert.deepEqual(parseCompactVerdict(none, types), { fired: [], unparseable: false });

  const one = serializeCompactVerdict(types, ['sycophancy']);
  const parsed = parseCompactVerdict(one, types);
  assert.equal(parsed.unparseable, false);
  assert.deepEqual(parsed.fired, ['sycophancy']);

  const two = serializeCompactVerdict(types, ['persona_claims', 'simulation_obscured']);
  assert.deepEqual(parseCompactVerdict(two, types).fired, [
    'persona_claims',
    'simulation_obscured',
  ]);
});

test('v3 parse rejects the wrong number of slots or any non yes/no token', () => {
  assert.equal(parseCompactVerdict('yes no', types).unparseable, true);
  assert.equal(parseCompactVerdict('', types).unparseable, true);
  const extra = `${serializeCompactVerdict(types, [])} yes`;
  assert.equal(parseCompactVerdict(extra, types).unparseable, true);
  const bad = serializeCompactVerdict(types, []).replace(/^no/, 'true');
  assert.equal(parseCompactVerdict(bad, types).unparseable, true);
  assert.deepEqual(parseCompactVerdict(`  ${serializeCompactVerdict(types, ['hate']).toUpperCase()}  `, types), {
    fired: ['hate'],
    unparseable: false,
  });
});

test('v3 GBNF has one yes/no slot per taxonomy class', () => {
  const gbnf = compactVerdictGbnf(types.length);
  const ynSlots = gbnf.match(/\byn\b/g) ?? [];
  // One in the yn production, plus one per class on the root line.
  assert.equal(ynSlots.length, types.length + 1);
  assert.match(gbnf, /"yes" \| "no"/);
  assert.equal(compactVerdictGbnf(1), 'root ::= yn\nyn ::= "yes" | "no"');
  assert.throws(() => compactVerdictGbnf(0));
});

test('v3 prompt lists every published class and the evaluated text, once', () => {
  const prompt = buildV3EvaluationPrompt(taxonomy, {
    providerId: 'p',
    content: 'Hello, how can I help you today?',
    prompt: 'hi',
  });
  assert.ok(prompt.includes('Hello, how can I help you today?'));
  assert.ok(prompt.includes('User turn:'));
  assert.ok(prompt.includes('hi'));
  assert.ok(prompt.includes('discussing, naming, quoting, or refusing'));
  assert.ok(prompt.includes(taxonomy.version));
  for (const def of taxonomy.flags) {
    assert.ok(prompt.includes(def.type), `missing ${def.type}`);
    assert.ok(prompt.includes(def.definition), `missing definition for ${def.type}`);
    for (const criterion of def.criteria) {
      assert.ok(
        prompt.includes(criterion.description),
        `missing criteria description ${criterion.id}`,
      );
      assert.equal(
        prompt.includes(criterion.pattern),
        false,
        `regex pattern ${criterion.id} must not be in the v3 prompt`,
      );
    }
    for (const ex of def.counterExamples ?? []) {
      assert.ok(prompt.includes(ex), `missing counterExample for ${def.type}: ${ex}`);
    }
  }
  assert.ok(prompt.includes('Output only that line'));
});
