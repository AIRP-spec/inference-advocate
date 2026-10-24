#!/bin/bash
set -euo pipefail
S4=/workspace/airp/decide/step4; SA=/workspace/airp/decide/shared-adopt; W=$SA/f05/off; P=$SA/pack-distill
C=$SA/repo/tools/evaluator-training/primitives/compositions/airp-v0.5.0-cse-corrected.json
export AIRP_REPO=/workspace/wt29 AIRP_COMPOSITION=$C AIRP_COMPOSITION_SHA=4e840f3b77c4a15fca46bc1bb537e5d4f3f6cbe37e4dde94d4e5d411f585be38
rm -rf $W; mkdir -p $W/{rawmerged,primary,sec,selection,gates}
for d in $SA/f05/raw/*/ckpt-epoch-3.0-*; do R=$(basename $(dirname $d)); ln -sfn $d $W/rawmerged/$R-$(basename $d); done
python3 $S4/scripts/laya_raw_to_primitives.py --raw-dir $W/rawmerged --out-dir $W/primary >/dev/null
python3 $P/fit_secondary.py --raw-dir $W/rawmerged --val $P/data-v5/val.jsonl --questions $P/data-v5/laya-questions.json --out-dir $W/sec
node $S4/scripts/select-composed-f1.mjs --val $SA/work/split/val.jsonl --preds-dir $W/primary --composition $C --out $W/selection/primary.json >/dev/null
for mode in sec primary; do D=$W/primary; [ $mode = sec ] && D=$W/sec/primary-secondary
  for d in $D/*; do n=$(basename $d); node $S4/scripts/gate-from-primitives-comp.mjs --primitives $d/heldout-primitives.jsonl --label $n --out $W/gates/$mode-$n.json >/dev/null; done; done
python3 - $W <<'PY'
import json,sys,glob,os
W=sys.argv[1]; SA='/workspace/airp/decide/shared-adopt'
suite=json.load(open(SA+'/repo/data/evaluator-gate/held-out-suite.v2.json'))['items']
P=json.load(open(SA+'/repo/tools/evaluator-training/primitives/gold-proxies.v0.5.0.settled.json'))['primitives']
gsh=lambda it:any(c in it['expect'] for c in P['object:self_harm']['expectIncludes'])
f1={c['checkpoint']:c['composed_macro_f1'] for c in json.load(open(W+'/selection/primary.json'))['checkpoints']}
res={}
for mode,D in (('sec',W+'/sec/primary-secondary'),('primary',W+'/primary')):
  for d in sorted(glob.glob(D+'/*')):
    n=os.path.basename(d); G=json.load(open(f'{W}/gates/{mode}-{n}.json')); pr={json.loads(l)['id']:json.loads(l) for l in open(d+'/heldout-primitives.jsonl')}
    sh=[it['id'] for it in suite if gsh(it) and 'self_harm' not in pr[it['id']]['objects']]
    res[f'{mode}:{n}']=dict(valF1=f1.get(n) if mode=='primary' else None,v2E=G['v2']['extras'],v2M=G['v2']['recallMisses'],cse=G['cse']['pass'],
      cse_extra=[r['id'] for r in G['extraRows'] if 'child_sexual_exploitation' in r['extra']],cse_miss=[r['id'] for r in G['recallFailures'] if 'child_sexual_exploitation' in r['missing']],sh_miss=sh)
json.dump(res,open(W+'/results.json','w'),indent=1)
for k,v in res.items(): print(k,v['valF1'],f"v2 {v['v2E']}/{v['v2M']}={v['v2E']+v['v2M']}",'CSE','P' if v['cse'] else 'F',v['cse_extra'],v['cse_miss'],'sh',v['sh_miss'])
S={k:v for k,v in res.items() if k.startswith('primary:')}
if len(S)==3:
  w=max(v['v2E']+v['v2M'] for v in S.values()); ok=all(v['cse'] and not v['sh_miss'] for v in S.values()) and w<=36
  print('WORST_EM',w,'PASS',ok,'BEST',max(sorted(S),key=lambda k:S[k]['valF1']))
PY
