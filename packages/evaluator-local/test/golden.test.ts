import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Taxonomy } from '@airp/core';
import { createLocalEvaluator, PROMPT_TEMPLATE_VERSION } from '@airp/evaluator-local';
import { dataPath, repoRoot } from './helpers.js';
import { goldenCases } from './fixtures.js';

const taxonomy = Taxonomy.loadFromFile(dataPath('taxonomy', 'flags.v0.json'));
const modelsDir = join(repoRoot, 'data', 'models');
const manifestPath = join(modelsDir, 'manifest.json');
const ggufFiles = existsSync(modelsDir)
  ? readdirSync(modelsDir).filter((name) => name.endsWith('.gguf'))
  : [];

/** v1 attractor false negatives that decomposition was expected to clear. */
const EXPECTED_ATTRACTOR_FN = new Set([
  'relational_hooks',
  'sycophancy',
  'simulation_obscured',
  'self_harm',
  'sexual_content',
  'violence',
  'hate',
  'criminal_assistance',
]);

/** v1 counter-example false positives that mention-versus-use was expected to clear. */
const EXPECTED_MENTION_FP = new Map<string, string>([
  ['persona_claims', 'persona-denial'],
  ['profanity', 'mentioned-expletive'],
  ['hate', 'named-class'],
  ['relational_hooks', 'counter-example / mention-versus-use'],
]);

test('golden fixtures cover every class in the current taxonomy file', () => {
  const cases = goldenCases(taxonomy);
  const types = new Set(taxonomy.flags.map((f) => f.type));
  for (const type of types) {
    assert.ok(
      cases.some((c) => c.type === type && c.shouldFlag),
      `missing positive fixture for ${type}`,
    );
    assert.ok(
      cases.some((c) => c.type === type && !c.shouldFlag),
      `missing negative fixture for ${type}`,
    );
  }
});

test('pinned model verdicts against golden fixtures', { timeout: 1_800_000 }, async (t) => {
  if (ggufFiles.length === 0 || !existsSync(manifestPath)) {
    console.log(
      'notice: skipping local evaluator verdict tests; data/models/ has no GGUF. Run npm run fetch:evaluator-model',
    );
    t.skip();
    return;
  }

  const pin = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    fileName: string;
    sha256: string;
    promptTemplateVersion: string;
  };
  const modelPath = join(modelsDir, pin.fileName);
  if (!existsSync(modelPath)) {
    console.log(
      `notice: skipping local evaluator verdict tests; ${pin.fileName} is not present. Run npm run fetch:evaluator-model`,
    );
    t.skip();
    return;
  }

  assert.equal(pin.promptTemplateVersion, PROMPT_TEMPLATE_VERSION);
  const evaluator = await createLocalEvaluator(
    { kind: 'local', modelPath, modelSha256: pin.sha256, gpu: false },
    taxonomy,
  );
  assert.equal(evaluator.id, 'local-llm');
  assert.equal(evaluator.version, `${pin.sha256.slice(0, 12)}+${pin.promptTemplateVersion}`);

  const cases = goldenCases(taxonomy);
  const rows: Array<{
    type: string;
    shouldFlag: boolean;
    pass: boolean;
    got: string;
    expectedFix: string | null;
  }> = [];
  const times: number[] = [];

  for (const c of cases) {
    const flags = await evaluator.evaluate({ providerId: 'fixture', content: c.content });
    times.push(evaluator.lastEvalMs);
    const hit = flags.some((f) => f.type === c.type);
    const pass = hit === c.shouldFlag;
    let expectedFix: string | null = null;
    if (!pass && c.shouldFlag && EXPECTED_ATTRACTOR_FN.has(c.type)) {
      expectedFix = 'attractor FN (v2 decomposition was expected to clear this)';
    } else if (!pass && !c.shouldFlag && EXPECTED_MENTION_FP.has(c.type)) {
      expectedFix = `${EXPECTED_MENTION_FP.get(c.type)} (v2 mention-versus-use was expected to clear this)`;
    }
    rows.push({
      type: c.type,
      shouldFlag: c.shouldFlag,
      pass,
      got: flags.map((f) => f.type).join(', ') || 'none',
      expectedFix,
    });
    const raw = (evaluator.lastRawByClass[c.type] ?? '').replace(/\s+/g, ' ').slice(0, 180);
    const mark = pass ? 'pass' : 'FAIL';
    const dir = c.shouldFlag ? 'positive' : 'counter';
    console.log(
      `  ${c.type.padEnd(28)} ${dir.padEnd(10)} ${mark}  got=[${rows[rows.length - 1]!.got}]  ${evaluator.lastEvalMs}ms` +
        (expectedFix ? `  [${expectedFix}]` : '') +
        (pass ? '' : `  raw=${JSON.stringify(raw)}`),
    );
  }

  const meanMs = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  const maxMs = Math.max(...times);
  console.log(
    `wall time: mean ${meanMs}ms per response (${taxonomy.flags.length} sequential class calls), max ${maxMs}ms, n=${times.length}`,
  );

  const failures = rows.filter((r) => !r.pass);
  if (failures.length === 0) return;

  const uncleared = failures.filter((r) => r.expectedFix);
  const novel = failures.filter((r) => !r.expectedFix);
  const lines = failures.map((r) => {
    const dir = r.shouldFlag ? 'positive FN' : 'counter FP';
    return `${r.type} ${dir}: got [${r.got}]. ${r.expectedFix ?? 'not on the v2 expected-fix list (fine-tune candidate)'}`;
  });
  assert.fail(
    `pinned Qwen3-0.6B ${pin.promptTemplateVersion} failed golden fixtures (${failures.length}/${rows.length}). ` +
      `${uncleared.length} remaining from the v2 expected-fix list, ${novel.length} novel. ` +
      `Do not iterate the template again in this task. Do not substitute a larger model. ` +
      `Mean wall time ${meanMs}ms.\n${lines.join('\n')}`,
  );
});
