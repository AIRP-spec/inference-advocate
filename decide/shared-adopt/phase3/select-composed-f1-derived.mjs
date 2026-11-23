#!/usr/bin/env node
// select-composed-f1.mjs (decide/step4/scripts, unchanged metric/tiebreak) with gold classes DERIVED at load
// time from gold primitives through composition 2a (ADR 2026-10-19 val gold classes derived). Asserts via val_gold.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadValDerived, VAL_SHA256 } from './val_gold.mjs';

const repo = process.env.AIRP_REPO || '/workspace/wt29';
const { compose } = await import(pathToFileURL(path.join(repo, 'packages/evaluator-local/dist/index.js')).href);
function arg(n){const i=process.argv.indexOf(n);return i>0?process.argv[i+1]:undefined;}
const { rows: valRows, composition, valSha256 } = await loadValDerived(arg('--val'), arg('--composition'), { valSha: arg('--val-sha') ?? VAL_SHA256, repo });
const classTypes = composition.classes.map(c=>c.class);
const valById = new Map(valRows.map(r=>[r.id,r]));
const predsDir = arg('--preds-dir');
const outPath = arg('--out');
function f1(pred, gold) {
  let tp=0,fp=0,fn=0;
  for (let i=0;i<pred.length;i++){ if(pred[i]&&gold[i])tp++; else if(pred[i])fp++; else if(gold[i])fn++; }
  const p=tp+fp?tp/(tp+fp):null, r=tp+fn?tp/(tp+fn):null;
  if(p===null&&r===null) return null;
  if(p===null||r===null) return 0;
  return p+r===0?0:(2*p*r)/(p+r);
}
function ckStep(name){ const m=String(name).match(/(?:step-|checkpoint-)(\d+)/); return m?parseInt(m[1],10):0; }
const ckptDirs = fs.readdirSync(predsDir).filter(n=>fs.statSync(path.join(predsDir,n)).isDirectory()).sort((a,b)=>ckStep(a)-ckStep(b));
const results=[];
for (const ck of ckptDirs) {
  const vp = path.join(predsDir, ck, 'val-primitives.jsonl');
  if (!fs.existsSync(vp)) { console.warn('skip', ck); continue; }
  const preds = fs.readFileSync(vp,'utf8').trim().split('\n').map(JSON.parse);
  if (preds.length !== valRows.length) throw new Error(`${ck}: ${preds.length} preds != ${valRows.length} val rows`);
  const goldSets=[], predSets=[]; let stanceOk=0;
  for (const pr of preds) {
    const g = valById.get(pr.id); if(!g) throw new Error('missing '+pr.id);
    goldSets.push(new Set(g.expect_derived));
    predSets.push(new Set(compose({stance:pr.stance, objects:pr.objects||[], qualifiers:pr.qualifiers||[]}, composition)));
    if (pr.stance === g.stance) stanceOk++;
  }
  const perClass={}; const f1s=[];
  for (const cls of classTypes) { const s=f1(predSets.map(x=>x.has(cls)), goldSets.map(x=>x.has(cls))); perClass[cls]=s; if(s!==null) f1s.push(s); }
  const macro = f1s.length? f1s.reduce((a,b)=>a+b,0)/f1s.length : 0;
  results.push({checkpoint:ck, step:ckStep(ck), composed_macro_f1:macro, n_classes_in_macro:f1s.length, per_class_f1:perClass, stance_accuracy:stanceOk/preds.length, n:preds.length});
  console.log(ck, 'macroF1=', macro.toFixed(4), 'stance=', (stanceOk/preds.length).toFixed(4));
}
results.sort((a,b)=>{ const m=b.composed_macro_f1-a.composed_macro_f1; if(Math.abs(m)>1e-12) return m;
  const s=b.stance_accuracy-a.stance_accuracy; if(Math.abs(s)>1e-12) return s; return b.step-a.step; });
const out={metric:'composed-class macro-F1 on validation, gold classes derived from gold primitives via 2a (ADR 2026-10-19)', val_sha256:valSha256, selected:results[0]?.checkpoint||null, tiebreak:'stance_accuracy then later step', checkpoints:results};
fs.writeFileSync(outPath, JSON.stringify(out,null,2)+'\n');
console.log('SELECTED', out.selected);
