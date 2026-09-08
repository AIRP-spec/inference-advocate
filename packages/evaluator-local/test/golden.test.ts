import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Taxonomy } from '@airp/core';
import { createLocalEvaluator, looksLikeThinking, PROMPT_TEMPLATE_VERSION } from '@airp/evaluator-local';
import { dataPath, repoRoot } from './helpers.js';
import { goldenCases } from './fixtures.js';
import {
  loadGateConfig,
  loadHeldOutSuite,
  scoreHeldOutGate,
  type ItemVerdict,
} from './held-out.js';

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

function hardwareStatement(): string {
  let lscpu = '';
  try {
    lscpu = execSync('lscpu', { encoding: 'utf8' });
  } catch {
    return 'lscpu unavailable';
  }
  const pick = (label: string) => {
    const line = lscpu.split('\n').find((l) => l.startsWith(label));
    return line ? line.split(':').slice(1).join(':').trim() : 'unknown';
  };
  const flags = pick('Flags');
  const has = (name: string) => (flags.split(/\s+/).includes(name) ? 'present' : 'absent');
  return [
    `CPU ${pick('Model name')}`,
    `${pick('CPU(s)')} cores`,
    `avx2 ${has('avx2')}`,
    `avx512f ${has('avx512f')}`,
    `fma ${has('fma')}`,
  ].join(', ');
}

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

  console.log(`hardware: ${hardwareStatement()}`);
  console.log(`llama.cpp: ${evaluator.systemInfo || '(empty system-info)'}`);

  const cases = goldenCases(taxonomy);
  const rows: Array<{
    type: string;
    shouldFlag: boolean;
    pass: boolean;
    got: string[];
    extras: string[];
    expectedFix: string | null;
  }> = [];
  const times: number[] = [];
  const suiteStarted = Date.now();
  let thoughtHits = 0;

  for (const c of cases) {
    const flags = await evaluator.evaluate({ providerId: 'fixture', content: c.content });
    times.push(evaluator.lastEvalMs);
    if (evaluator.lastThoughtDetected) thoughtHits += 1;
    const got = flags.map((f) => f.type);
    const hit = got.includes(c.type);
    const pass = hit === c.shouldFlag;
    const extras = c.shouldFlag ? got.filter((type) => type !== c.type) : [];
    let expectedFix: string | null = null;
    if (!pass && c.shouldFlag && EXPECTED_ATTRACTOR_FN.has(c.type)) {
      expectedFix = 'attractor FN (v2 decomposition was expected to clear this)';
    } else if (!pass && !c.shouldFlag && EXPECTED_MENTION_FP.has(c.type)) {
      expectedFix = `${EXPECTED_MENTION_FP.get(c.type)} (v2 mention-versus-use was expected to clear this)`;
    }
    rows.push({ type: c.type, shouldFlag: c.shouldFlag, pass, got, extras, expectedFix });
    const raw = (evaluator.lastRawByClass[c.type] ?? '').replace(/\s+/g, ' ').slice(0, 180);
    const mark = pass ? 'pass' : 'FAIL';
    const dir = c.shouldFlag ? 'positive' : 'counter';
    const extraNote = extras.length > 0 ? ` extras=[${extras.join(', ')}]` : '';
    console.log(
      `  ${c.type.padEnd(28)} ${dir.padEnd(10)} ${mark}  got=[${got.join(', ') || 'none'}]  ${evaluator.lastEvalMs}ms` +
        extraNote +
        (expectedFix ? `  [${expectedFix}]` : '') +
        (pass ? '' : `  raw=${JSON.stringify(raw)}`),
    );
    if (looksLikeThinking(raw)) {
      console.log(`    THINK TAG IN RAW VERDICT for ${c.type}`);
    }
  }

  const suiteMs = Date.now() - suiteStarted;
  const meanMs = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  const maxMs = Math.max(...times);
  const extraOnPositives = rows.filter((r) => r.shouldFlag).reduce((n, r) => n + r.extras.length, 0);
  console.log(
    `wall time: mean ${meanMs}ms per response, max ${maxMs}ms, suite ${suiteMs}ms, n=${times.length}`,
  );
  console.log(
    `precision on smoke (reported, not gating; the v3 held-out gate gates this): ${extraOnPositives} extra classes fired across ${rows.filter((r) => r.shouldFlag).length} positives`,
  );
  console.log(`thinking tags in raw generations: ${thoughtHits} of ${cases.length} responses`);

  const failures = rows.filter((r) => !r.pass);
  if (failures.length === 0) return;

  const uncleared = failures.filter((r) => r.expectedFix);
  const novel = failures.filter((r) => !r.expectedFix);
  const lines = failures.map((r) => {
    const dir = r.shouldFlag ? 'positive FN' : 'counter FP';
    return `${r.type} ${dir}: got [${r.got.join(', ')}]. ${r.expectedFix ?? 'not on the v2 expected-fix list (fine-tune candidate)'}`;
  });
  assert.fail(
    `pinned Qwen3-0.6B ${pin.promptTemplateVersion} failed golden fixtures (${failures.length}/${rows.length}). ` +
      `${uncleared.length} remaining from the v2 expected-fix list, ${novel.length} novel. ` +
      `Mean wall time ${meanMs}ms, suite ${suiteMs}ms. One decode pass, then stop.\n${lines.join('\n')}`,
  );
});

test('trained pin against the full held-out gate', { timeout: 3_600_000 }, async (t) => {
  if (ggufFiles.length === 0 || !existsSync(manifestPath)) {
    t.skip();
    return;
  }
  const pin = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    fileName: string;
    sha256: string;
    promptTemplateVersion: string;
  };
  const gate = loadGateConfig();
  if (pin.promptTemplateVersion !== gate.appliesWhen.promptTemplateVersion) {
    console.log(
      `notice: skipping full held-out gate; live pin is ${pin.promptTemplateVersion}, gate applies at ${gate.appliesWhen.promptTemplateVersion}`,
    );
    t.skip();
    return;
  }
  const modelPath = join(modelsDir, pin.fileName);
  if (!existsSync(modelPath)) {
    t.skip();
    return;
  }

  assert.equal(pin.promptTemplateVersion, PROMPT_TEMPLATE_VERSION);
  const evaluator = await createLocalEvaluator(
    { kind: 'local', modelPath, modelSha256: pin.sha256, gpu: false },
    taxonomy,
  );
  const suite = loadHeldOutSuite();
  console.log(`hardware: ${hardwareStatement()}`);
  console.log(`llama.cpp: ${evaluator.systemInfo || '(empty system-info)'}`);
  console.log(`held-out gate: ${suite.items.length} items, extra-class limit ${gate.rules.maxSuiteExtraClassFires.value}`);

  const verdicts: ItemVerdict[] = [];
  for (const item of suite.items) {
    const flags = await evaluator.evaluate({
      providerId: 'held-out',
      content: item.content,
      prompt: item.prompt,
    });
    const got = flags.map((f) => f.type);
    verdicts.push({ id: item.id, got, ms: evaluator.lastEvalMs });
    const extra = got.filter((type) => !item.expect.includes(type));
    const missing = item.expect.filter((type) => !got.includes(type));
    const mark = missing.length === 0 && extra.length === 0 ? 'pass' : 'FAIL';
    console.log(
      `  ${item.id.padEnd(42)} ${item.kind.padEnd(10)} ${mark}  got=[${got.join(', ') || 'none'}]  ${evaluator.lastEvalMs}ms` +
        (missing.length ? `  missing=[${missing.join(', ')}]` : '') +
        (extra.length ? `  extra=[${extra.join(', ')}]` : ''),
    );
  }

  const score = scoreHeldOutGate(suite, gate, verdicts);
  console.log(
    `wall time: mean ${score.meanMs}ms, clean-path mean ${score.meanCleanPathMs}ms, fire-path mean ${score.meanFirePathMs}ms, n=${score.n}`,
  );
  console.log(
    `precision (gating): ${score.extraClassFires} extra-class fires, limit ${score.extraLimit}`,
  );
  console.log(`recall (gating): ${score.recallFailures.length} items missed an expected class`);
  if (score.pass) return;

  const lines = [
    ...score.recallFailures.map(
      (r) => `${r.id} missed [${r.missing.join(', ')}] extra=[${r.extra.join(', ')}]`,
    ),
    ...score.rows
      .filter((r) => r.extra.length > 0 && r.missing.length === 0)
      .map((r) => `${r.id} extra=[${r.extra.join(', ')}]`),
  ];
  assert.fail(
    `trained pin failed the held-out gate (${score.recallFailures.length} recall failures, ${score.extraClassFires} extra-class fires, limit ${score.extraLimit}). ` +
      `Mean ${score.meanMs}ms, clean ${score.meanCleanPathMs}ms, fire ${score.meanFirePathMs}ms.\n${lines.join('\n')}`,
  );
});
