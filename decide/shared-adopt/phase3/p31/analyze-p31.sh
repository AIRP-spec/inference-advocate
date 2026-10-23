#!/bin/bash
# P3-1 analyzer (DECLARATION-P3-1). Selection-before-v2: phases safety -> select -> em.
#   analyze-p31.sh safety <workdir> <podroot>   (podroot = box copy of /workspace/p31 with out/)
#   analyze-p31.sh select <workdir>             (writes P3-1-SELECTION.json; commit+push before em)
#   analyze-p31.sh em <workdir>
set -euo pipefail
PHASE=$1; W=$2; shift 2
S4=/workspace/airp/decide/step4; PL=/workspace/airp/phase3plan/repo; P3=$PL/decide/shared-adopt/phase3
C=$PL/tools/evaluator-training/primitives/compositions/airp-v0.5.0-cse-corrected-2a.json
VAL=$PL/decide/shared-adopt/round/val.jsonl
SUITE=$S4/inputs/held-out-suite.v2.json; PROX=$S4/inputs/gold-proxies.v0.5.0.settled.json
export AIRP_REPO=/workspace/wt29 AIRP_COMPOSITION=$C AIRP_COMPOSITION_SHA=59ddf1f630ec2dcd81d40dd01f2adb53f1310fe42128d3ccc9b90de61e28ab9e
echo "59ddf1f630ec2dcd81d40dd01f2adb53f1310fe42128d3ccc9b90de61e28ab9e  $C
5be292a911f0082a74c6e24beb20a60455fab4a86baded561784d37f2b453009  $VAL
82f8e720fbb1d146a93a09da86484dada04561cffd85293be435c0ed0000ad77  $SUITE
b086cdac11f8af39b2d3984232ee0372d9ffe909acbd4b8d7fe6d4f653d08455  $PROX" | sha256sum -c --quiet || exit 3

if [ "$PHASE" = safety ]; then
  POD=$1
  rm -rf "$W"; mkdir -p "$W"/{rawmerged,primary,selection,gates}
  for d in $POD/out/raw-avg/p31-*; do
    [ -f $d/.done ] || continue; R=$(basename $d)
    ln -sfn $d/avg-$R-ge2.0 $W/rawmerged/avg-$R
    [ -d $POD/out/raw-cavg/$R/cavg-$R ] && ln -sfn $POD/out/raw-cavg/$R/cavg-$R $W/rawmerged/cavg-$R
    for e in 2.0 2.5 3.0 3.5 4.0; do
      CK=$(ls -d $POD/out/raw/$R/ckpt-epoch-$e-* 2>/dev/null | sort | head -1 || true)
      [ -n "$CK" ] && ln -sfn $CK $W/rawmerged/ind-$R-ep$e
    done
  done
  python3 $S4/scripts/laya_raw_to_primitives.py --raw-dir $W/rawmerged --out-dir $W/primary >/dev/null
  node $P3/select-composed-f1-derived.mjs --val $VAL --composition $C --preds-dir $W/primary --out $W/selection/primary.json >/dev/null
  for d in $W/primary/*; do n=$(basename $d); node $S4/scripts/gate-from-primitives-comp.mjs --primitives $d/heldout-primitives.jsonl --label $n --out $W/gates/$n.json >/dev/null; done
  python3 - "$W" "$POD" "$SUITE" "$PROX" <<'PY'
import json,sys,glob,os,statistics as st
W,POD,SUITE,PROX=sys.argv[1:5]
suite=json.load(open(SUITE))['items']; P=json.load(open(PROX))['primitives']
gsh=lambda it:any(c in it['expect'] for c in P['object:self_harm']['expectIncludes'])
f1={c['checkpoint']:c['composed_macro_f1'] for c in json.load(open(W+'/selection/primary.json'))['checkpoints']}
full={}
for d in sorted(glob.glob(W+'/primary/*')):
  n=os.path.basename(d); G=json.load(open(f'{W}/gates/{n}.json')); pr={json.loads(l)['id']:json.loads(l) for l in open(d+'/heldout-primitives.jsonl')}
  cse_extra=[r['id'] for r in G['extraRows'] if 'child_sexual_exploitation' in r['extra']]
  cse_miss=[r['id'] for r in G['recallFailures'] if 'child_sexual_exploitation' in r['missing']]
  sh_miss=[it['id'] for it in suite if gsh(it) and 'self_harm' not in pr[it['id']]['objects']]
  sh_class_miss=[r['id'] for r in G['recallFailures'] if 'self_harm' in r['missing']]
  cse_ok=bool(G['cse']['pass'] and not cse_extra and not cse_miss)
  full[n]=dict(valF1=f1.get(n),v2E=G['v2']['extras'],v2M=G['v2']['recallMisses'],cse=cse_ok,cse_extra=cse_extra,cse_miss=cse_miss,
               sh_miss=sh_miss,sh_class_miss=sh_class_miss,safety_pass=cse_ok and not sh_miss and not sh_class_miss,primSha=G['primitivesSha256'])
json.dump(full,open(W+'/results-full-internal.json','w'),indent=1)
pub={k:{**{kk:vv for kk,vv in v.items() if kk not in ('v2E','v2M')},'v2E':'MASKED','v2M':'MASKED'} for k,v in full.items()}
json.dump(pub,open(W+'/results-safety.json','w'),indent=1)
runs=sorted({k.split('-',1)[1].rsplit('-ep',1)[0] for k in pub if k.startswith('ind-')})
per={}
for R in runs:
  arm,seed=R.split('-')[1],R.split('-')[2]
  conv=json.load(open(f'{POD}/out/conv/{R}.json'))
  inds={k:v for k,v in pub.items() if k.startswith(f'ind-{R}-ep')}
  a=pub.get(f'avg-{R}')
  per[R]=dict(arm=arm,seed=seed,artifact_clean=bool(a and a['safety_pass']),all_ge2_clean=all(v['safety_pass'] for v in inds.values()),
     n_ge2=len(inds),failing=[k for k,v in list(inds.items())+[(f'avg-{R}',a)] if v and not v['safety_pass']],
     artifact_valF1=a['valF1'] if a else None,flips=conv['flips'],final_flip=conv['flips'][max(conv['flips'],key=float)],
     converged_ckpts=conv['converged'],cavg_clean=pub[f'cavg-{R}']['safety_pass'] if f'cavg-{R}' in pub else None,
     converged_clean=[pub[f'ind-{R}-ep{c.split("-")[2]}']['safety_pass'] for c in conv['converged'] if f'ind-{R}-ep{c.split("-")[2]}' in pub])
arms={}
for arm in ('A0','A1','A2'):
  rs=[v for v in per.values() if v['arm']==arm]
  if not rs: continue
  f=[r['artifact_valF1'] for r in rs]
  arms[arm]=dict(N=len(rs),k_clean=sum(r['artifact_clean'] and r['all_ge2_clean'] for r in rs),k_artifact_clean=sum(r['artifact_clean'] for r in rs),
     mean_final_flip=round(st.mean(r['final_flip'] for r in rs),3),valF1_mean=round(st.mean(f),4),valF1_sd=round(st.stdev(f),4) if len(f)>1 else None,
     mean_n_converged=round(st.mean(len(r['converged_ckpts']) for r in rs),2),
     converged_ckpts_clean=f"{sum(sum(r['converged_clean']) for r in rs)}/{sum(len(r['converged_clean']) for r in rs)}")
json.dump(dict(per_run=per,arms=arms),open(W+'/summary-safety.json','w'),indent=1)
for R,v in per.items(): print(R,'artifact',('P' if v['artifact_clean'] else 'F'),'all>=2.0',('P' if v['all_ge2_clean'] else 'F'),'valF1 %.4f'%v['artifact_valF1'],'flips',v['flips'],'conv',len(v['converged_ckpts']),'fail',v['failing'])
for a,v in arms.items(): print('ARM',a,v)
PY

elif [ "$PHASE" = select ]; then
  python3 - "$W" <<'PY'
import json,sys,hashlib,datetime
from pathlib import Path
W=Path(sys.argv[1]); S=json.load(open(W/'summary-safety.json'))['arms']
# Declared rule: most seeds safety-clean at artifact AND every ckpt >= 2.0; ties -> lower mean final flip rate,
# then lower val-F1 SD (derived gold). If no tail arm beats A0 -> A0 (keep 3-epoch cosine).
order=sorted(S.items(), key=lambda kv:(-kv[1]['k_clean'], kv[1]['mean_final_flip'], kv[1]['valF1_sd'] if kv[1]['valF1_sd'] is not None else 9))
win=order[0][0]
if win!='A0' and S[win]['k_clean']<=S.get('A0',{}).get('k_clean',-1): win='A0'
ts=datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
sel=dict(winner=win,arms=S,ranking=[k for k,_ in order],rule='most seeds safety-clean at artifact and every ckpt>=2.0; tie -> lower mean final flip; tie -> lower val-F1 SD; a tail arm must beat A0 strictly',timestamp_utc=ts,note='v2 E+M not computed or printed before this file was committed')
p=W/'P3-1-SELECTION.json'; p.write_text(json.dumps(sel,indent=2)+'\n')
sha=hashlib.sha256(p.read_bytes()).hexdigest(); (W/'P3-1-SELECTION.json.sha256').write_text(f'{sha}  P3-1-SELECTION.json\n')
print('WINNER',win,'sha',sha,'ts',ts)
PY

elif [ "$PHASE" = em ]; then
  [ -f "$W/P3-1-SELECTION.json" ] || { echo "no selection file"; exit 4; }
  python3 - "$W" <<'PY'
import json,sys,statistics as st
from pathlib import Path
W=Path(sys.argv[1]); full=json.load(open(W/'results-full-internal.json'))
out={}
for arm in ('A0','A1','A2'):
  for kind in ('avg','cavg','ind'):
    ks=[k for k in full if k.startswith(f'{kind}-p31-{arm}-')]
    if kind=='ind':
      for e in ('2.0','2.5','3.0','3.5','4.0'):
        kk=[k for k in ks if k.endswith('-ep'+e)]
        if kk: em=[full[k]['v2E']+full[k]['v2M'] for k in kk]; out[f'{arm} ep{e}']=dict(n=len(em),mean=round(st.mean(em),2),sd=round(st.stdev(em),2) if len(em)>1 else None,min=min(em),max=max(em),values=sorted(em))
    elif ks:
      em=[full[k]['v2E']+full[k]['v2M'] for k in sorted(ks)]; out[f'{arm} {kind}']=dict(n=len(em),mean=round(st.mean(em),2),sd=round(st.stdev(em),2) if len(em)>1 else None,min=min(em),max=max(em),values=em)
json.dump(dict(em=out,per_artifact={k:dict(E=v['v2E'],M=v['v2M'],EM=v['v2E']+v['v2M']) for k,v in sorted(full.items())}),open(W/'results-em.json','w'),indent=1)
for k,v in out.items(): print('EM',k,v)
PY
else echo "unknown phase" >&2; exit 2; fi
