import json,os,subprocess,collections
SA='/workspace/airp/decide/shared-adopt'; E=SA+'/ens'
C=SA+'/repo/tools/evaluator-training/primitives/compositions/airp-v0.5.0-cse-corrected.json'
env=dict(os.environ,AIRP_REPO='/workspace/wt29',AIRP_COMPOSITION=C,AIRP_COMPOSITION_SHA='4e840f3b77c4a15fca46bc1bb537e5d4f3f6cbe37e4dde94d4e5d411f585be38')
M={'round1':SA+'/offline/primary/round1-ckpt-epoch-3.0-step-690','round2':SA+'/offline/primary/round2-ckpt-epoch-3.0-step-690'}
for s in (3,4,5): M[f'fresh-s{s}']=f'{SA}/fresh/off/primary/fresh-s{s}-ckpt-epoch-3.0-step-690'
suite=json.load(open(SA+'/repo/data/evaluator-gate/held-out-suite.v2.json'))['items']
P=json.load(open(SA+'/repo/tools/evaluator-training/primitives/gold-proxies.v0.5.0.settled.json'))['primitives']
gsh=lambda it:any(c in it['expect'] for c in P['object:self_harm']['expectIncludes'])
ref=[json.loads(l) for l in open(M['round1']+'/heldout-primitives.jsonl')][0]
def load(d): return {json.loads(l)['id']:json.loads(l) for l in open(d+'/heldout-probs.jsonl')}
probs={k:load(d) for k,d in M.items()}
# which keys are qualifiers vs objects: learn from a primitives file schema
QUAL=set(); OBJ=set()
for k,d in M.items():
  for l in open(d+'/heldout-primitives.jsonl'):
    r=json.loads(l); QUAL|=set(r['qualifiers']); OBJ|=set(r['objects'])
def gate(name,rows):
  d=f'{E}/{name}'; os.makedirs(d,exist_ok=True); open(d+'/heldout-primitives.jsonl','w').write('\n'.join(json.dumps(r) for r in rows)+'\n')
  subprocess.run(['node','/workspace/airp/decide/step4/scripts/gate-from-primitives-comp.mjs','--primitives',d+'/heldout-primitives.jsonl','--label',name,'--out',d+'/gate.json'],env=env,check=True,capture_output=True)
  g=json.load(open(d+'/gate.json')); pr={r['id']:r for r in rows}
  sh=[it['id'] for it in suite if gsh(it) and 'self_harm' not in pr[it['id']]['objects']]
  fails=set(r['id'] for r in g['extraRows'])|set(r['id'] for r in g['recallFailures'])
  return dict(v2E=g['v2']['extras'],v2M=g['v2']['recallMisses'],cse=g['cse'],cse_extra=[r['id'] for r in g['extraRows'] if 'child_sexual_exploitation' in r['extra']],
    cse_miss=[r['id'] for r in g['recallFailures'] if 'child_sexual_exploitation' in r['missing']],sh_miss=sh,fails=sorted(fails))
# verify reconstruction of single-model primitives from probs matches stored
import sys
qualkeys=None
def build(members):
  rows=[]
  for it in suite:
    i=it['id']; ps=[probs[m][i] for m in members]
    pt={k:sum(p['p_true'][k] for p in ps)/len(ps) for k in ps[0]['p_true']}
    sp={k:sum(p['stance_probs'][k] for p in ps)/len(ps) for k in ps[0]['stance_probs']}
    fired=[k for k,v in pt.items() if v>=0.5]
    rows.append(dict(id=i,stance=max(sp,key=sp.get),objects=[k for k in fired if k in KIND and KIND[k]=='o'],qualifiers=[k for k in fired if k in KIND and KIND[k]=='q']))
  return rows
KIND={}
for k in OBJ: KIND[k]='o'
for k in QUAL: KIND[k]='q'
keys=set(next(iter(probs['round1'].values()))['p_true'])
missing=keys-set(KIND); print('unseen keys',missing,file=sys.stderr)
for k in missing: KIND[k]='q' if k in ('subject_is_minor','is_mention_not_use','addresses_own_nature','asserts_interior_state','directed_at_user','exceeds_common_knowledge','explicit_register','targets_protected_characteristic') else 'o'
res={}
for m in M:  # sanity: single-member build == stored
  rows=build([m]); st={json.loads(l)['id']:json.loads(l) for l in open(M[m]+'/heldout-primitives.jsonl')}
  bad=sum(1 for r in rows if sorted(r['objects'])!=sorted(st[r['id']]['objects']) or sorted(r['qualifiers'])!=sorted(st[r['id']]['qualifiers']) or r['stance']!=st[r['id']]['stance'])
  res[m]=gate('single-'+m,rows); res[m]['rebuild_mismatch']=bad
res['ens5']=gate('ens5',build(list(M))); res['ens3f']=gate('ens3f',build(['fresh-s3','fresh-s4','fresh-s5']))
json.dump(res,open(E+'/results.json','w'),indent=1)
for k,v in res.items(): print(k,f"E+M {v['v2E']}+{v['v2M']}={v['v2E']+v['v2M']}",'CSE','P' if v['cse']['pass'] else 'F',v['cse_extra'],v['cse_miss'],'sh',v['sh_miss'],'rb',v.get('rebuild_mismatch'))
cnt=collections.Counter(i for m in M for i in res[m]['fails'])
print('\nitem failing on any single seed: n_seeds/5, ens5, ens3f')
for i,n in sorted(cnt.items(),key=lambda x:(-x[1],x[0])): print(f"{i:52s} {n}/5 ens5={'F' if i in res['ens5']['fails'] else '.'} ens3f={'F' if i in res['ens3f']['fails'] else '.'}")
extra=set(res['ens5']['fails'])|set(res['ens3f']['fails']); print('ensemble-only fails:',sorted(extra-set(cnt)))
