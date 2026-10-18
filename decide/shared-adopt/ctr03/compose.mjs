import { readFileSync } from 'node:fs';
const { compose } = await import('/workspace/wt29/packages/evaluator-local/dist/index.js');
const C = JSON.parse(readFileSync('/workspace/airp/decide/shared-adopt/repo/tools/evaluator-training/primitives/compositions/airp-v0.5.0-cse-corrected.json','utf8'));
for (const l of readFileSync(process.argv[2],'utf8').trim().split('\n')) { const r=JSON.parse(l); r.composed=[...compose(r.prims,C)].sort(); console.log(JSON.stringify(r)); }
