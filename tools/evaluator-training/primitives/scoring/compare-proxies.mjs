#!/usr/bin/env node
/**
 * Compare the shared proxy file (PR #26, gold-proxies.v0.5.0.json, unchanged) with the Qwen per-atom audit
 * (per-atom-precision-converged.json). The audit records gold-yes counts per atom on held-out v2, not the
 * proxy rule itself, so the comparison is: PR #26 gold count per primitive vs audit goldYes, plus coverage.
 *   node compare-proxies.mjs --audit per-atom-precision-converged.json --out proxy-compare.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../..');
const a = process.argv.slice(2);
const opt = (k) => a[a.indexOf(k) + 1];
const sha = (p) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const proxyPath = path.join(repoRoot, 'tools/evaluator-training/primitives/gold-proxies.v0.5.0.json');
const proxies = JSON.parse(fs.readFileSync(proxyPath, 'utf8')).primitives;
const audit = JSON.parse(fs.readFileSync(opt('--audit'), 'utf8'));
const suite = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/evaluator-gate/held-out-suite.v2.json'), 'utf8'));
const goldCount = (key) => suite.items.filter((i) => proxies[key].expectIncludes.some((c) => i.expect.includes(c))).length;
const auditByAtom = new Map(audit.rows.map((r) => [r.atom, r]));
const rows = [];
const seen = new Set();
for (const key of Object.keys(proxies)) {
  const name = key.split(':')[1];
  const r = auditByAtom.get(name);
  seen.add(name);
  const pr26Gold = goldCount(key);
  const auditGold = r && r.byCk['8560'].goldYes != null ? r.byCk['8560'].goldYes : null; // null = audit has no proxy
  rows.push({ key, pr26ExpectIncludes: proxies[key].expectIncludes, pr26GoldOnV2: pr26Gold, auditGoldOnV2: auditGold, agree: auditGold === pr26Gold });
}
for (const r of audit.rows) if (!seen.has(r.atom)) rows.push({ key: r.atom, pr26ExpectIncludes: null, pr26GoldOnV2: null, auditGoldOnV2: r.byCk['8560'].goldYes ?? null, agree: r.byCk['8560'].goldYes == null });
const out = { proxyFileSha256: sha(proxyPath), auditSha256: sha(opt('--audit')), auditNote: audit.note, rows, disagreements: rows.filter((r) => !r.agree).map((r) => r.key) };
fs.writeFileSync(opt('--out'), JSON.stringify(out, null, 1));
for (const r of rows) console.log(`${r.agree ? '  ' : '!!'} ${r.key.padEnd(40)} pr26=${r.pr26GoldOnV2} audit=${r.auditGoldOnV2} ${r.pr26ExpectIncludes ? r.pr26ExpectIncludes.join('|') : '(no PR26 proxy)'}`);
