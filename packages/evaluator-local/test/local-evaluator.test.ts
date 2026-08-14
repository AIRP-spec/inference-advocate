import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { Taxonomy } from '@airp/core';
import { dataPath } from './helpers.js';
import {
  buildClassEvaluationPrompt,
  parseBinaryVerdict,
  sha256FileHex,
  verifyModelSha256,
} from '@airp/evaluator-local';

const taxonomy = Taxonomy.loadFromFile(dataPath('taxonomy', 'flags.v0.json'));

test('digest verification names both hashes on mismatch', () => {
  const dir = mkdtempSync(join(tmpdir(), 'airp-local-eval-'));
  try {
    const path = join(dir, 'toy.gguf');
    writeFileSync(path, 'not-a-real-model');
    const actual = sha256FileHex(path);
    const expected = '00'.repeat(32);
    assert.notEqual(actual, expected);
    assert.throws(() => verifyModelSha256(path, expected), (err: Error) => {
      assert.match(err.message, /digest mismatch/);
      assert.ok(err.message.includes(expected));
      assert.ok(err.message.includes(actual));
      assert.ok(err.message.includes('toy.gguf'));
      return true;
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('digest verification accepts a matching pin', () => {
  const dir = mkdtempSync(join(tmpdir(), 'airp-local-eval-'));
  try {
    const path = join(dir, 'toy.gguf');
    writeFileSync(path, 'not-a-real-model');
    const expected = createHash('sha256').update('not-a-real-model').digest('hex');
    assert.equal(verifyModelSha256(path, expected), expected);
    assert.equal(verifyModelSha256(path, `SHA256:${expected.toUpperCase()}`), expected);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a per-class prompt contains only that class, plus counter-examples and mention-versus-use', () => {
  const persona = taxonomy.definition('persona_claims');
  const sycophancy = taxonomy.definition('sycophancy');
  assert.ok(persona && sycophancy);
  const prompt = buildClassEvaluationPrompt(persona, {
    providerId: 'p',
    content: 'hello',
    prompt: 'how are you',
  });
  assert.ok(prompt.includes(persona.definition));
  assert.ok(prompt.includes(persona.criteria[0]!.description));
  assert.ok(prompt.includes(persona.counterExamples![0]!));
  assert.ok(prompt.includes('discussing, naming, quoting, or refusing'));
  assert.ok(prompt.includes('User turn:'));
  assert.ok(prompt.includes('hello'));
  assert.equal(prompt.includes(sycophancy.type), false);
  assert.equal(prompt.includes(sycophancy.definition), false);
  for (const other of taxonomy.flags) {
    if (other.type === persona.type) continue;
    assert.equal(
      prompt.includes(`Class: ${other.title}`),
      false,
      `prompt for persona_claims must not name ${other.type}`,
    );
  }
});

test('unparseable binary output is not fired', () => {
  const parsed = parseBinaryVerdict('I am sorry, I cannot help with that.', 'hello there');
  assert.equal(parsed.unparseable, true);
  assert.equal(parsed.fired, false);
  assert.equal(parsed.evidence, null);
});

test('truncated JSON is not fired', () => {
  const parsed = parseBinaryVerdict('{"fired":true,"evidence":', 'What a brilliant question!');
  assert.equal(parsed.unparseable, true);
  assert.equal(parsed.fired, false);
});

test('fired with verbatim evidence keeps the span; invented evidence is dropped', () => {
  const text = 'What a brilliant question!';
  const hit = parseBinaryVerdict(
    '{"fired":true,"evidence":"brilliant question"}',
    text,
  );
  assert.equal(hit.unparseable, false);
  assert.equal(hit.fired, true);
  assert.equal(hit.evidence, 'brilliant question');

  const miss = parseBinaryVerdict('{"fired":true,"evidence":"not in the source"}', text);
  assert.equal(miss.fired, true);
  assert.equal(miss.evidence, null);

  const quiet = parseBinaryVerdict('{"fired":false,"evidence":null}', text);
  assert.equal(quiet.fired, false);
  assert.equal(quiet.evidence, null);
});
