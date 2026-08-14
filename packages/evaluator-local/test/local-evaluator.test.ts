import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { parseTaxonomyEvaluationVerdict, Taxonomy } from '@airp/core';
import { dataPath } from './helpers.js';
import { sha256FileHex, verifyModelSha256 } from '@airp/evaluator-local';

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

test('unparseable model text yields zero flags rather than invented ones', () => {
  const parsed = parseTaxonomyEvaluationVerdict(
    taxonomy,
    'I am sorry, I cannot help with that.',
    'hello there',
    'local',
  );
  assert.equal(parsed.unparseable, true);
  assert.equal(parsed.flags.length, 0);
});

test('truncated JSON yields zero flags', () => {
  const parsed = parseTaxonomyEvaluationVerdict(
    taxonomy,
    '{"flags":[{"type":"sycophancy"',
    'What a brilliant question!',
    'local',
  );
  assert.equal(parsed.unparseable, true);
  assert.equal(parsed.flags.length, 0);
});

test('a type outside the taxonomy is dropped', () => {
  const parsed = parseTaxonomyEvaluationVerdict(
    taxonomy,
    '{"flags":[{"type":"invented_type","evidence":["hello"],"reason":"nope"},{"type":"sycophancy","evidence":["brilliant question"],"reason":"flattery"}]}',
    'What a brilliant question!',
    'local',
  );
  assert.equal(parsed.unparseable, false);
  assert.equal(parsed.flags.length, 1);
  assert.equal(parsed.flags[0]?.type, 'sycophancy');
  assert.equal(parsed.flags[0]?.severity, 1);
});
