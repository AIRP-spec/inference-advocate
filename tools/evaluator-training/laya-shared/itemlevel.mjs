#!/usr/bin/env node
// Item-level comparison on held-out v2: "right" = composed class set equals gold `expect` (order-insensitive),
// primary thresholds, shared compose (declaration §6). Usage:
//   AIRP_REPO=<repo with packages/evaluator-local/dist> node itemlevel.mjs --a A.jsonl --b B.jsonl --label-a 5766 --label-b shared --suite S --composition C --out out.json
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const repo = process.env.AIRP_REPO || '/workspace/wt29';
const { compose } = await import(pathToFileURL(path.join(repo, 'packages/evaluator-local/dist/index.js')).href);
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const read = (p) => fs.readFileSync(p, 'utf8').trim().split('\n').map(JSON.parse);
const composition = JSON.parse(fs.readFileSync(arg('--composition'), 'utf8'));
const suite = JSON.parse(fs.readFileSync(arg('--suite'), 'utf8'));
const A = new Map(read(arg('--a')).map((r) => [r.id, r]));
const B = new Map(read(arg('--b')).map((r) => [r.id, r]));
const la = arg('--label-a', 'A'), lb = arg('--label-b', 'B');
const comp = (p) => [...new Set(compose({ stance: p.stance, objects: p.objects || [], qualifiers: p.qualifiers || [] }, composition))].sort();
const eq = (x, y) => x.length === y.length && x.every((v, i) => v === y[i]);
const cnt = { both_right: 0, only_b_right: 0, only_a_right: 0, both_wrong: 0 };
let verdictDiff = 0;
const rows = [];
for (const it of suite.items) {
  const gold = [...new Set(it.expect || [])].sort();
  const pa = comp(A.get(it.id)), pb = comp(B.get(it.id));
  const ra = eq(pa, gold), rb = eq(pb, gold);
  const k = ra && rb ? 'both_right' : rb ? 'only_b_right' : ra ? 'only_a_right' : 'both_wrong';
  cnt[k]++;
  if (!eq(pa, pb)) verdictDiff++;
  rows.push({ id: it.id, gold, [la]: pa, [lb]: pb, cell: k });
}
const out = { n: suite.items.length, labelA: la, labelB: lb, both_right: cnt.both_right, [`only_${lb}_right`]: cnt.only_b_right,
  [`only_${la}_right`]: cnt.only_a_right, both_wrong: cnt.both_wrong, composed_verdicts_differ: verdictDiff, rows };
fs.writeFileSync(arg('--out'), JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify({ ...out, rows: undefined }));
