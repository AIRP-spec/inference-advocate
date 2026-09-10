#!/usr/bin/env node
// Summarize gated sweep checkpoints: extra fires and recall misses vs loss.
//
// Paper: step 8. Provisional Section 3.3. This report does not publish.
// A checkpoint is a publish candidate only if extra-class fires are 0 and
// recall misses are 0. Anything else on the sampled curve is a coverage gap
// until shown otherwise: loss can reach zero while the same held-out misses
// remain. Do not report that as a capacity ceiling.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');

export function fmtLoss(loss) {
  if (loss === null || loss === undefined) return 'unknown';
  const n = Number(loss);
  if (!Number.isFinite(n)) return 'unknown';
  if (n >= 0.01) return n.toFixed(4);
  return n.toPrecision(2);
}

export function pickVerdict(rows) {
  const passing = rows.filter((r) => r.extraClassFires === 0 && r.recallMisses === 0);
  if (passing.length > 0) {
    passing.sort((a, b) => a.epoch - b.epoch);
    const best = passing[0];
    return {
      kind: 'candidate',
      best,
      nearest: null,
      text: `best checkpoint is epoch ${best.epoch}, loss ${fmtLoss(best.loss)}, ${best.extraClassFires} extra fires, ${best.recallMisses} recall misses, candidate for publish gate`,
    };
  }
  const ranked = [...rows].sort((a, b) => {
    const sa = a.extraClassFires + a.recallMisses;
    const sb = b.extraClassFires + b.recallMisses;
    if (sa !== sb) return sa - sb;
    if (a.extraClassFires !== b.extraClassFires) return a.extraClassFires - b.extraClassFires;
    return a.epoch - b.epoch;
  });
  const nearest = ranked[0] || null;
  return {
    kind: 'coverage-gap',
    best: null,
    nearest,
    text:
      'no checkpoint achieves both; coverage gap on the sampled curve. ' +
      'Training loss can reach zero while the same held-out misses remain. ' +
      'That is not a capacity ceiling.',
  };
}

export function formatTable(rows) {
  const hasHistorical = rows.some((r) => r.historicalSubset);
  const headers = [
    'epoch',
    'loss',
    'extra-fires',
    'recall-misses',
    'clean-fires',
    'per-class-pass',
    'gate',
  ];
  if (hasHistorical) {
    headers.push('hist-extra', 'hist-recall', 'hist-gate');
  }
  const body = rows.map((r) => {
    const base = [
      String(r.epoch),
      fmtLoss(r.loss),
      String(r.extraClassFires),
      String(r.recallMisses),
      String(r.cleanFires),
      `${r.perClassPass}/${r.perClassTotal}`,
      r.pass ? 'PASS' : 'FAIL',
    ];
    if (hasHistorical) {
      const hist = r.historicalSubset;
      base.push(
        hist ? String(hist.extraClassFires) : '-',
        hist ? String(hist.recallMisses) : '-',
        hist ? (hist.pass ? 'PASS' : 'FAIL') : '-',
      );
    }
    return base;
  });
  const widths = headers.map((h, i) => Math.max(h.length, ...body.map((row) => row[i].length)));
  const line = (cells) =>
    cells.map((c, i) => c.padEnd(widths[i])).join('  ');
  return [line(headers), line(widths.map((w) => '-'.repeat(w))), ...body.map(line)].join('\n');
}

export function formatCurve(rows, key, label) {
  if (rows.length === 0) return `${label}: (no rows)`;
  const values = rows.map((r) => r[key]);
  const max = Math.max(1, ...values);
  const height = 8;
  const lines = [`${label} (y) vs epoch (x)`];
  for (let h = height; h >= 0; h--) {
    const threshold = (max * h) / height;
    const labelY = String(Math.round(threshold)).padStart(4);
    const marks = rows.map((r) => (r[key] >= threshold - max / (height * 2) ? '*' : ' ')).join('  ');
    lines.push(`${labelY} | ${marks}`);
  }
  const xs = rows.map((r) => String(r.epoch).padStart(3)).join(' ');
  lines.push(`     +-${'-'.repeat(Math.max(1, rows.length * 3 - 1))}`);
  lines.push(`       ${xs}`);
  return lines.join('\n');
}

function loadRows(repo = repoRoot, recipeRel = 'tools/evaluator-training/sweep-recipe.json') {
  const recipe = JSON.parse(readFileSync(join(repo, recipeRel), 'utf8'));
  const outDir = join(repo, recipe.outputs.dir);
  const ckptPath = join(outDir, recipe.outputs.checkpoints);
  if (!existsSync(ckptPath)) {
    throw new Error(`no checkpoints at ${ckptPath}`);
  }
  const payload = JSON.parse(readFileSync(ckptPath, 'utf8'));
  const rows = [];
  for (const ck of payload.checkpoints || []) {
    const reportPath = ck.gateReport || join(outDir, `gate-report-step-${ck.step}.json`);
    if (!existsSync(reportPath)) {
      throw new Error(`no gate report for step ${ck.step} at ${reportPath}`);
    }
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    const perClass = report.perClass || [];
    const row = {
      step: ck.step,
      epoch: ck.epoch,
      loss: ck.loss,
      extraClassFires: report.extraClassFires,
      recallMisses: (report.recallFailures || []).length,
      cleanFires: (report.cleanFires || []).length,
      perClassPass: perClass.filter((c) => c.pass).length,
      perClassTotal: perClass.length,
      pass: report.pass === true,
      pin: report.pin,
      ggufPath: ck.ggufPath,
      gateReport: reportPath,
    };
    if (report.historicalSubset) {
      row.historicalSubset = {
        name: report.historicalSubset.name,
        n: report.historicalSubset.n,
        extraClassFires: report.historicalSubset.extraClassFires,
        recallMisses: (report.historicalSubset.recallFailures || []).length,
        pass: report.historicalSubset.pass === true,
      };
    }
    rows.push(row);
  }
  return { recipe, payload, rows, outDir };
}

function main() {
  const { recipe, payload, rows, outDir } = loadRows();
  const verdict = pickVerdict(rows);
  const table = formatTable(rows);
  const extraCurve = formatCurve(rows, 'extraClassFires', 'extra-class fires');
  const recallCurve = formatCurve(rows, 'recallMisses', 'recall misses');
  console.log(`sweep: seed ${payload.seed}, base ${payload.baseRepoId}, n=${payload.n}`);
  console.log(`checkpoints: ${rows.length} (min ${recipe.sweep.minCheckpoints})`);
  console.log('');
  console.log(table);
  console.log('');
  console.log(extraCurve);
  console.log('');
  console.log(recallCurve);
  console.log('');
  console.log(`verdict: ${verdict.text}`);
  if (verdict.kind === 'ceiling' && verdict.nearest) {
    console.log(
      `nearest miss: epoch ${verdict.nearest.epoch}, loss ${fmtLoss(verdict.nearest.loss)}, ${verdict.nearest.extraClassFires} extra fires, ${verdict.nearest.recallMisses} recall misses`,
    );
  }
  const report = {
    paper: recipe.paper,
    adr: recipe.adr,
    seed: payload.seed,
    baseRepoId: payload.baseRepoId,
    promptTemplateVersion: payload.promptTemplateVersion,
    n: payload.n,
    saveEveryEpoch: payload.saveEveryEpoch,
    checkpoints: rows,
    verdict: {
      kind: verdict.kind,
      text: verdict.text,
      best: verdict.best,
      nearest: verdict.nearest,
    },
    table,
    extraCurve,
    recallCurve,
  };
  const reportPath = join(outDir, recipe.outputs.sweepReport);
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(`wrote ${reportPath}`);
}

const isMain = process.argv[1]?.endsWith('sweep-report.mjs');
if (isMain) {
  main();
}
