/**
 * Tests for template v4 (primitives evaluator).
 * 
 * Paper: step 8. Provisional Section 3.3.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRIMITIVES_CATALOGUE_V1,
  serializeCompactPrimitives,
  parseCompactPrimitives,
  compactPrimitivesGbnf,
  buildV4System,
  buildV4User,
  buildV4ChatTurns,
  type PrimitivesVerdict,
} from '../src/prompt-v4.js';
import type { EvaluationRequest } from '@airp/core';

describe('prompt-v4: serializeCompactPrimitives', () => {
  it('violence depiction', () => {
    const verdict: PrimitivesVerdict = {
      stance: 'depicts',
      objects: ['violence_person'],
      qualifiers: [],
    };
    const line = serializeCompactPrimitives(verdict);
    // stance + 7 objects + 10 qualifiers = 18 tokens
    const tokens = line.split(' ');
    assert.equal(tokens.length, 18);
    assert.equal(tokens[0], 'depicts');
    assert.equal(tokens[1], 'yes'); // violence_person
    assert.equal(tokens[2], 'no'); // self_harm
  });

  it('violence + CA (method)', () => {
    const verdict: PrimitivesVerdict = {
      stance: 'conveys_method',
      objects: ['violence_person'],
      qualifiers: ['exceeds_common_knowledge'],
    };
    const line = serializeCompactPrimitives(verdict);
    const tokens = line.split(' ');
    assert.equal(tokens.length, 18);
    assert.equal(tokens[0], 'conveys_method');
    assert.equal(tokens[1], 'yes'); // violence_person
    assert.equal(tokens[15], 'yes'); // exceeds_common_knowledge (7th qualifier)
  });

  it('CSE dual', () => {
    const verdict: PrimitivesVerdict = {
      stance: 'encourages',
      objects: ['sexual_activity'],
      qualifiers: ['subject_is_minor'],
    };
    const line = serializeCompactPrimitives(verdict);
    const tokens = line.split(' ');
    assert.equal(tokens.length, 18);
    assert.equal(tokens[0], 'encourages');
    assert.equal(tokens[3], 'yes'); // sexual_activity
    assert.equal(tokens[9], 'yes'); // subject_is_minor (2nd qualifier)
  });

  it('clean (mention-versus-use)', () => {
    const verdict: PrimitivesVerdict = {
      stance: 'describes',
      objects: [],
      qualifiers: ['is_mention_not_use'],
    };
    const line = serializeCompactPrimitives(verdict);
    const tokens = line.split(' ');
    assert.equal(tokens.length, 18);
    assert.equal(tokens[0], 'describes');
    assert.equal(tokens[16], 'yes'); // is_mention_not_use (8th qualifier)
  });
});

describe('prompt-v4: parseCompactPrimitives', () => {
  it('parses violence depiction', () => {
    const line = 'depicts yes no no no no no no no no no no no no no no no no';
    const parsed = parseCompactPrimitives(line);
    assert.equal(parsed.unparseable, false);
    assert.equal(parsed.stance, 'depicts');
    assert.deepEqual(parsed.objects, ['violence_person']);
    assert.deepEqual(parsed.qualifiers, []);
  });

  it('parses violence + CA', () => {
    const line = 'conveys_method yes no no no no no no no no no no no no no yes no no no';
    const parsed = parseCompactPrimitives(line);
    assert.equal(parsed.unparseable, false);
    assert.equal(parsed.stance, 'conveys_method');
    assert.deepEqual(parsed.objects, ['violence_person']);
    assert.deepEqual(parsed.qualifiers, ['exceeds_common_knowledge']);
  });

  it('round-trip: violence + CA', () => {
    const verdict: PrimitivesVerdict = {
      stance: 'conveys_method',
      objects: ['violence_person'],
      qualifiers: ['exceeds_common_knowledge'],
    };
    const line = serializeCompactPrimitives(verdict);
    const parsed = parseCompactPrimitives(line);
    assert.equal(parsed.unparseable, false);
    assert.equal(parsed.stance, verdict.stance);
    assert.deepEqual(parsed.objects, verdict.objects);
    assert.deepEqual(parsed.qualifiers, verdict.qualifiers);
  });

  it('rejects invalid stance', () => {
    const line = 'invalid_stance yes no no no no no no no no no no no no no no no no';
    const parsed = parseCompactPrimitives(line);
    assert.equal(parsed.unparseable, true);
  });

  it('rejects wrong token count', () => {
    const line = 'depicts yes no no';
    const parsed = parseCompactPrimitives(line);
    assert.equal(parsed.unparseable, true);
  });
});

describe('prompt-v4: compactPrimitivesGbnf', () => {
  it('generates valid GBNF', () => {
    const gbnf = compactPrimitivesGbnf();
    assert.ok(gbnf.includes('root ::='));
    assert.ok(gbnf.includes('stance ::='));
    assert.ok(gbnf.includes('"describes"'));
    assert.ok(gbnf.includes('"conveys_method"'));
    assert.ok(gbnf.includes('yn ::= "yes" | "no"'));
  });
});

describe('prompt-v4: buildV4System', () => {
  it('builds system prompt with primitives catalogue', () => {
    const system = buildV4System();
    assert.ok(system.includes('You are an evaluator'));
    assert.ok(system.includes('primitives vocabulary'));
    assert.ok(system.includes('Stance'));
    assert.ok(system.includes('Objects'));
    assert.ok(system.includes('Qualifiers'));
    assert.ok(system.includes('describes:'));
    assert.ok(system.includes('violence_person:'));
    assert.ok(system.includes('exceeds_common_knowledge:'));
    assert.ok(system.includes('Standing rule'));
  });
});

describe('prompt-v4: buildV4ChatTurns', () => {
  it('builds chat turns', () => {
    const req: EvaluationRequest = {
      id: 'test-1',
      content: 'Blood ran from the crushed throat.',
    };
    const turns = buildV4ChatTurns(req);
    assert.ok(turns.system.includes('primitives vocabulary'));
    assert.ok(turns.user.includes('Blood ran from the crushed throat.'));
  });
});
