// Ensemble latency: N separate LayaSharedLocalEvaluator instances (own ORT session each), evaluate() sequentially per item, time summed.
import { createHash } from 'node:crypto'; import { readFileSync, writeFileSync } from 'node:fs'; import { join } from 'node:path'; import { performance } from 'node:perf_hooks';
const arg=(n,d)=>{const i=process.argv.indexOf(n);return i>0?process.argv[i+1]:d;};
const repo=arg('--repo'); const N=Number(arg('--n')); const B=Number(arg('--bucket','500'));
const { LayaSharedLocalEvaluator } = await import(join(repo,'packages/evaluator-local/dist/index.js'));
const { Taxonomy } = await import(join(repo,'packages/core/dist/index.js'));
const taxonomy=Taxonomy.loadFromFile(join(repo,'data/taxonomy/flags.v0.json'));
const pins=arg('--pins'); const pinsSha=createHash('sha256').update(readFileSync(pins)).digest('hex');
const evs=[]; for(let k=0;k<N;k++){const ev=new LayaSharedLocalEvaluator({taxonomy,modelPath:join(arg('--bundle'),'laya-shared.onnx'),modelSha256:JSON.parse(readFileSync(pins,'utf8')).onnx.sha256,pinsPath:pins,pinsSha256:pinsSha,compositionPath:arg('--composition'),compositionSha256:arg('--composition-sha'),intraOpNumThreads:8}); await ev.load(); evs.push(ev);}
const suite=JSON.parse(readFileSync(arg('--suite'),'utf8')).items;
const run=async(c)=>{const s=performance.now(); for(const ev of evs) await ev.evaluate({providerId:'ens',prompt:'',content:c}); return performance.now()-s;};
for(const it of suite.slice(0,20)) await run(it.content);
const rows=readFileSync(arg('--pinned'),'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l)).filter(r=>r.bucket===B);
for(const r of rows.slice(0,2)) await run(r.text);
const ms=[]; for(const r of rows) ms.push(await run(r.text));
const s=[...ms].sort((a,b)=>a-b); const med=(s[9]+s[10])/2; const p95=s[Math.ceil(0.95*s.length)-1];
const out={n_models:N,bucket:B,n:ms.length,median_ms:med,p95_ms:p95,max_ms:s[s.length-1],rss_gb:process.memoryUsage().rss/2**30,ms};
console.log(JSON.stringify(out)); writeFileSync(arg('--out'),JSON.stringify(out,null,1));
