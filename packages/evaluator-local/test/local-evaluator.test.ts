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
  buildClassVerdictQuestion,
  buildSharedPrefix,
  looksLikeThinking,
  parseEvidenceSpan,
  parseVerdict,
  sha256FileHex,
  verifyModelSha256,
  LocalEvaluator,
  PROMPT_TEMPLATE_VERSION,
  PROMPT_TEMPLATE_V3,
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
  assert.ok(prompt.includes('Answer yes or no'));
  assert.equal(prompt.includes('{'), false);
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

test('the shared prefix carries the evaluated text and no class titles', () => {
  const prefix = buildSharedPrefix({ providerId: 'p', content: 'hello there', prompt: 'hi' });
  assert.ok(prefix.includes('hello there'));
  assert.ok(prefix.includes('discussing, naming, quoting, or refusing'));
  assert.ok(prefix.includes('User turn:'));
  for (const def of taxonomy.flags) {
    assert.equal(prefix.includes(`Class: ${def.title}`), false);
  }
  const persona = taxonomy.definition('persona_claims')!;
  const question = buildClassVerdictQuestion(persona);
  assert.equal(question.includes('hello there'), false);
  assert.ok(question.includes(persona.definition));
});

test('verdict parse accepts only yes or no', () => {
  assert.deepEqual(parseVerdict('yes'), { fired: true, unparseable: false });
  assert.deepEqual(parseVerdict('no'), { fired: false, unparseable: false });
  assert.deepEqual(parseVerdict('YES\n'), { fired: true, unparseable: false });
  assert.deepEqual(parseVerdict('{"fired":true}'), { fired: false, unparseable: true });
  assert.deepEqual(parseVerdict(''), { fired: false, unparseable: true });
});

test('evidence that is not a verbatim span is dropped', () => {
  const text = 'What a brilliant question!';
  assert.equal(parseEvidenceSpan('brilliant question', text), 'brilliant question');
  assert.equal(parseEvidenceSpan('"brilliant question"', text), 'brilliant question');
  assert.equal(parseEvidenceSpan('not in the source', text), null);
  assert.equal(parseEvidenceSpan('<verbatim>brilliant question</verbatim>', text), null);
});

test('think tags are detected for debug logging', () => {
  assert.equal(looksLikeThinking('yes'), false);
  assert.equal(looksLikeThinking('<think>\nreasoning\n</think>\nyes'), true);
});

test('v3 construction binds digest plus v3 and does not change the live default', () => {
  assert.equal(PROMPT_TEMPLATE_VERSION, 'v2.1');
  assert.equal(PROMPT_TEMPLATE_V3, 'v3');
  const dir = mkdtempSync(join(tmpdir(), 'airp-local-eval-'));
  try {
    const path = join(dir, 'toy.gguf');
    writeFileSync(path, 'not-a-real-model');
    const digest = createHash('sha256').update('not-a-real-model').digest('hex');
    const v21 = new LocalEvaluator({ taxonomy, modelPath: path, modelSha256: digest });
    assert.equal(v21.version, `${digest.slice(0, 12)}+v2.1`);
    assert.equal(v21.promptTemplateVersion, 'v2.1');
    const v3 = new LocalEvaluator({
      taxonomy,
      modelPath: path,
      modelSha256: digest,
      promptTemplateVersion: 'v3',
    });
    assert.equal(v3.version, `${digest.slice(0, 12)}+v3`);
    assert.equal(v3.promptTemplateVersion, 'v3');
    assert.throws(
      () =>
        new LocalEvaluator({
          taxonomy,
          modelPath: path,
          modelSha256: digest,
          promptTemplateVersion: 'v2',
        }),
      /unsupported promptTemplateVersion/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
