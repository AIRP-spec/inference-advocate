"""Phase 3 read-only analysis: class-set flip rate between consecutive half-epoch checkpoints on val (gold-free, v2-free).
Inputs: per-checkpoint raw val.jsonl from the FRESH-05..10 pod relays (box paths below; not in git).
Needs airp_v3 (PR #34, v3/ at 1767890) on PYTHONPATH or AIRP_V3 env. Output: convergence-flips.json."""
import json,os,sys,statistics as st
sys.path.insert(0,os.environ.get("AIRP_V3","/workspace/airp/v3prep/repo/v3"))
from airp_v3.compose import compose, load_composition, OBJECTS, QUALIFIERS
C=load_composition()
B='/workspace/airp/decide/shared-adopt/'
runs={'f05-s12':'f05/raw/f05-s12','f05-s13':'f05/raw/f05-s13','f05-s14':'f05/raw/f05-s14','f06-s15':'f06/raw/f06-s15',
 'f07-s18':'f07/pod/out/raw/f07-s18','f07-s19':'f07/pod/out/raw/f07-s19','f07-s20':'f07/pod/out/raw/f07-s20','f08-s21':'f08/pod/out/raw/f08-s21',
 'f09-s24':'f09/pod/out/raw/f09-s24','f10-s27':'f10/pod/out/raw/f10-s27'}
SAFE=['subject_is_minor','sexual_activity','self_harm']
def load(p):
  out={}
  for l in open(p):
    r=json.loads(l); lg=r['logits']
    on={q for q in OBJECTS+QUALIFIERS if q in lg and lg[q][1]>lg[q][0]}
    pr={'stance':r['stance_choice'],'objects':[o for o in OBJECTS if o in on],'qualifiers':[q for q in QUALIFIERS if q in on]}
    out[r['id']]=(pr,frozenset(compose(pr,C)),frozenset(on&set(SAFE)))
  return out
res={}
for s,d in runs.items():
  ck=sorted({c for c in os.listdir(B+d) if c.startswith('ckpt')},key=lambda c:(float(c.split('-')[2]),int(c.split('-')[4])))
  seen={};
  for c in ck: seen.setdefault(c.split('-')[2],c)   # first (lowest step) per epoch, matches ls|sort|head -1
  P={e:load(B+d+'/'+c+'/val.jsonl') for e,c in seen.items()}
  eps=sorted(P,key=float); row=[]
  for a,b in zip(eps,eps[1:]):
    ids=P[a].keys()&P[b].keys()
    cls=sum(P[a][i][1]!=P[b][i][1] for i in ids)/len(ids)
    stn=sum(P[a][i][0]['stance']!=P[b][i][0]['stance'] for i in ids)/len(ids)
    saf=sum(P[a][i][2]!=P[b][i][2] for i in ids)
    row.append((b,round(100*cls,2),round(100*stn,2),saf))
  res[s]=row; print(s,row)
json.dump(res,open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'convergence-flips.json'),'w'),indent=1)
print('MEAN')
for e in ['1.0','1.5','2.0','2.5','3.0']:
  v=[x for r in res.values() for x in r if x[0]==e]
  print(e,'n',len(v),'cls%% mean %.2f min %.2f max %.2f'%(st.mean(x[1] for x in v),min(x[1] for x in v),max(x[1] for x in v)),'stance%% %.2f'%st.mean(x[2] for x in v),'safety-prim rows %.1f'%st.mean(x[3] for x in v))
