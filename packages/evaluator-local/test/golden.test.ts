import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Taxonomy } from '@airp/core';
import { createLocalEvaluator } from '@airp/evaluator-local';
import { dataPath, repoRoot } from './helpers.js';
import { goldenCases } from './fixtures.js';

const taxonomy = Taxonomy.loadFromFile(dataPath('taxonomy', 'flags.v0.json'));
const modelsDir = join(repoRoot, 'data', 'models');
const manifestPath = join(modelsDir, 'manifest.json');
const ggufFiles = existsSync(modelsDir)
  ? readdirSync(modelsDir).filter((name) => name.endsWith('.gguf'))
  : [];

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

test('pinned model verdicts against golden fixtures', { timeout: 600_000 }, async (t) => {
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

  const evaluator = await createLocalEvaluator(
    { kind: 'local', modelPath, modelSha256: pin.sha256, gpu: false },
    taxonomy,
  );
  assert.equal(evaluator.id, 'local-llm');
  assert.equal(evaluator.version, `${pin.sha256.slice(0, 12)}+${pin.promptTemplateVersion}`);

  const cases = goldenCases(taxonomy);
  const failures: string[] = [];
  for (const c of cases) {
    const flags = await evaluator.evaluate({ providerId: 'fixture', content: c.content });
    const hit = flags.some((f) => f.type === c.type);
    if (hit !== c.shouldFlag) {
      const kinds = flags.map((f) => f.type).join(', ') || 'none';
      const raw = evaluator.lastRawText.replace(/\s+/g, ' ').slice(0, 240);
      failures.push(
        `${c.label}: expected ${c.shouldFlag ? 'flag' : 'no flag'} for ${c.type}, got [${kinds}]. ` +
          `raw=${JSON.stringify(raw)} example=${JSON.stringify(c.content)}`,
      );
    }
  }

  if (failures.length > 0) {
    const byType = new Map<string, { fp: number; fn: number }>();
    for (const c of cases) {
      const row = failures.find((f) => f.startsWith(c.label));
      if (!row) continue;
      const acc = byType.get(c.type) ?? { fp: 0, fn: 0 };
      if (c.shouldFlag) acc.fn += 1;
      else acc.fp += 1;
      byType.set(c.type, acc);
    }
    const summary = [...byType.entries()]
      .map(([type, n]) => `${type}: ${n.fn} false negative(s), ${n.fp} false positive(s)`)
      .join('; ');
    assert.fail(
      `pinned Qwen3-0.6B failed golden fixtures (${failures.length}/${cases.length}). ` +
        `${summary}. Do not substitute a larger model; the next step is a better prompt or a fine-tune. ` +
        `Details:\n${failures.join('\n')}`,
    );
  }
});
