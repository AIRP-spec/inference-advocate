#!/bin/bash
# FRESH-10 gate analyzer (ADR 2026-10-19): selection-before-v2.
# Phases:
#   safety  — CSE/self_harm + val F1; v2 E+M MASKED in stdout and results-safety.json
#   select  — pick candidate by val F1; write CANDIDATE-SELECTION.json (caller commits/pushes)
#   em      — compute/print v2 E+M for candidate first, then non-candidates (requires selection file)
# Usage:
#   analyze-f10.sh safety <workdir> <label=rawdir>...
#   analyze-f10.sh select <workdir>
#   analyze-f10.sh em <workdir>
set -euo pipefail
PHASE=$1; W=$2; shift 2
S4=/workspace/airp/decide/step4; SA=/workspace/airp/decide/shared-adopt
C=$SA/repo/tools/evaluator-training/primitives/compositions/airp-v0.5.0-cse-corrected-2a.json
export AIRP_REPO=/workspace/wt29 AIRP_COMPOSITION=$C AIRP_COMPOSITION_SHA=59ddf1f630ec2dcd81d40dd01f2adb53f1310fe42128d3ccc9b90de61e28ab9e
[ "$(sha256sum $C | cut -d' ' -f1)" = 59ddf1f630ec2dcd81d40dd01f2adb53f1310fe42128d3ccc9b90de61e28ab9e ] || exit 3

if [ "$PHASE" = safety ]; then
  rm -rf "$W"; mkdir -p "$W"/{rawmerged,primary,selection,gates}
  for a in "$@"; do ln -sfn "${a#*=}" "$W/rawmerged/${a%%=*}"; done
  python3 $S4/scripts/laya_raw_to_primitives.py --raw-dir $W/rawmerged --out-dir $W/primary >/dev/null
  node $S4/scripts/select-composed-f1.mjs --val $SA/work/split/val.jsonl --preds-dir $W/primary --composition $C --out $W/selection/primary.json >/dev/null
  for d in $W/primary/*; do n=$(basename $d); node $S4/scripts/gate-from-primitives-comp.mjs --primitives $d/heldout-primitives.jsonl --label $n --out $W/gates/$n.json >/dev/null; done
  python3 - "$W" <<'PY'
import json,sys,glob,os
W=sys.argv[1]; SA='/workspace/airp/decide/shared-adopt'
suite=json.load(open(SA+'/repo/data/evaluator-gate/held-out-suite.v2.json'))['items']
P=json.load(open(SA+'/repo/tools/evaluator-training/primitives/gold-proxies.v0.5.0.settled.json'))['primitives']
gsh=lambda it:any(c in it['expect'] for c in P['object:self_harm']['expectIncludes'])
f1={c['checkpoint']:c['composed_macro_f1'] for c in json.load(open(W+'/selection/primary.json'))['checkpoints']}
# Keep full internal; emit masked public results
full={}; pub={}
for d in sorted(glob.glob(W+'/primary/*')):
  n=os.path.basename(d); G=json.load(open(f'{W}/gates/{n}.json')); pr={json.loads(l)['id']:json.loads(l) for l in open(d+'/heldout-primitives.jsonl')}
  cse_extra=[r['id'] for r in G['extraRows'] if 'child_sexual_exploitation' in r['extra']]
  cse_miss=[r['id'] for r in G['recallFailures'] if 'child_sexual_exploitation' in r['missing']]
  sh_miss=[it['id'] for it in suite if gsh(it) and 'self_harm' not in pr[it['id']]['objects']]
  sh_class_miss=[r['id'] for r in G['recallFailures'] if 'self_harm' in r['missing']]
  cse_ok=bool(G['cse']['pass'] and not cse_extra and not cse_miss)
  sh_ok=not sh_miss and not sh_class_miss
  safety_pass=cse_ok and sh_ok
  full[n]=dict(valF1=f1.get(n),v2E=G['v2']['extras'],v2M=G['v2']['recallMisses'],v1E=G['v1_207']['extras'],v1M=G['v1_207']['recallMisses'],
    cse=cse_ok,cse_extra=cse_extra,cse_miss=cse_miss,sh_miss=sh_miss,sh_class_miss=sh_class_miss,safety_pass=safety_pass,primSha=G['primitivesSha256'])
  pub[n]=dict(valF1=f1.get(n),v2E='MASKED',v2M='MASKED',v2EM='MASKED',v1E='MASKED',v1M='MASKED',
    cse=cse_ok,cse_extra=cse_extra,cse_miss=cse_miss,sh_miss=sh_miss,sh_class_miss=sh_class_miss,safety_pass=safety_pass,primSha=G['primitivesSha256'])
json.dump(full,open(W+'/results-full-internal.json','w'),indent=1)
json.dump(pub,open(W+'/results-safety.json','w'),indent=1)
# Mask check: public file must not contain raw E+M integers under v2 keys
for k,v in pub.items():
  assert v['v2E']=='MASKED' and v['v2M']=='MASKED' and v['v2EM']=='MASKED'
  print(k, round(v['valF1'],4), 'v2 MASKED', 'CSE','P' if v['cse'] else 'F', v['cse_extra'], v['cse_miss'],
        'sh',v['sh_miss'],'shC',v['sh_class_miss'], 'SAFETY','PASS' if v['safety_pass'] else 'FAIL')
open(W+'/safety.verdict','w').write('PASS\n' if all(v['safety_pass'] for v in pub.values()) else 'FAIL\n')
PY

elif [ "$PHASE" = select ]; then
  python3 - "$W" <<'PY'
import json,sys,hashlib,datetime
from pathlib import Path
W=Path(sys.argv[1])
full=json.load(open(W/'results-full-internal.json'))
# Only averaged artifacts are candidates
avgs={k:v for k,v in full.items() if k.startswith('avg-')}
assert avgs, 'no avg-* artifacts'
# All must have passed safety (caller should have stopped earlier; double-check)
bad=[k for k,v in full.items() if not v['safety_pass']]
assert not bad, f'safety failures present: {bad}'
# Highest val F1; tie → lower seed (lexicographic label works for f10-s27 < f10-s28 < f10-s29)
cand=sorted(avgs.items(), key=lambda kv: (-kv[1]['valF1'], kv[0]))[0][0]
ts=datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
sel=dict(candidate=cand, valF1=avgs[cand]['valF1'],
         ranking=[{'id':k,'valF1':v['valF1']} for k,v in sorted(avgs.items(), key=lambda kv: (-kv[1]['valF1'], kv[0]))],
         rule='highest val composed-class macro-F1; tie → lower seed id',
         timestamp_utc=ts,
         note='v2 E+M not yet computed or printed for this run')
path=W/'CANDIDATE-SELECTION.json'
path.write_text(json.dumps(sel, indent=2)+'\n')
sha=hashlib.sha256(path.read_bytes()).hexdigest()
(path.with_suffix('.json.sha256')).write_text(f'{sha}  CANDIDATE-SELECTION.json\n')
meta=dict(selection_sha256=sha, candidate=cand, timestamp_utc=ts)
(W/'CANDIDATE-SELECTION.meta.json').write_text(json.dumps(meta, indent=2)+'\n')
print('CANDIDATE', cand, 'valF1', round(avgs[cand]['valF1'],4), 'sha', sha, 'ts', ts)
print('COMMIT_THEN_EM: commit+push CANDIDATE-SELECTION.json (+.sha256) before running phase em')
PY

elif [ "$PHASE" = em ]; then
  python3 - "$W" <<'PY'
import json,sys
from pathlib import Path
W=Path(sys.argv[1])
sel=json.load(open(W/'CANDIDATE-SELECTION.json'))
full=json.load(open(W/'results-full-internal.json'))
cand=sel['candidate']
assert cand in full
LIMIT=33
# Candidate first
rows=[]
def row(k,v,is_cand):
  em=v['v2E']+v['v2M']
  acc_pass = em<=LIMIT
  # bar for candidate: safety (already) + accuracy; for non-cand: record only
  return dict(id=k,is_candidate=is_cand,valF1=v['valF1'],v2E=v['v2E'],v2M=v['v2M'],v2EM=em,
              v1E=v['v1E'],v1M=v['v1M'],cse=v['cse'],cse_miss=v['cse_miss'],sh_miss=v['sh_miss'],sh_class_miss=v['sh_class_miss'],
              safety_pass=v['safety_pass'],accuracy_pass=acc_pass if is_cand else None)
out={'candidate': row(cand, full[cand], True),
     'non_candidates': [row(k,v,False) for k,v in sorted(full.items()) if k!=cand],
     'limit': LIMIT,
     'candidate_accuracy_pass': (full[cand]['v2E']+full[cand]['v2M'])<=LIMIT}
json.dump(out, open(W/'results-em.json','w'), indent=1)
c=out['candidate']
print('CANDIDATE_EM', c['id'], round(c['valF1'],4), f"v2 {c['v2E']}/{c['v2M']}={c['v2EM']}", 'ACC', 'PASS' if c['accuracy_pass'] else 'FAIL')
for n in out['non_candidates']:
  print('RECORD', n['id'], round(n['valF1'],4), f"v2 {n['v2E']}/{n['v2M']}={n['v2EM']}", 'SAFETY', 'PASS' if n['safety_pass'] else 'FAIL')
open(W/'em.verdict','w').write('PASS\n' if out['candidate_accuracy_pass'] else 'FAIL\n')
if not out['candidate_accuracy_pass']:
  raise SystemExit(10)
PY

else
  echo "unknown phase: $PHASE" >&2; exit 2
fi
