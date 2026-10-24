import json,math,sys
QK=json.load(open('/workspace/airp/decide/shared-adopt/node/repo/tools/evaluator-training/laya-shared-node/pins/laya-shared-A570-fp32.pins.json'))
OBJ=QK['primitiveKinds']['objects']; QUAL=QK['primitiveKinds']['qualifiers']; SO=QK['stanceOrder']
def sm(v): m=max(v); e=[math.exp(x-m) for x in v]; s=sum(e); return [x/s for x in e]
out=[]
for f in sys.argv[1:]:
  for l in open(f):
    r=json.loads(l); lg=r['logits']; P={q:sm(v)[1] for q,v in lg.items() if q!='stance'}
    st=sm(lg['stance']); sc=SO[max(range(5),key=lambda i:st[i])]
    assert r.get('stance_choice') in (None,sc), (r['run'],r['ckpt'],sc,r.get('stance_choice'))
    out.append(dict(run=r['run'],ckpt=r['ckpt'],id=r['id'],p_yes=P,stance_p=dict(zip(SO,st)),
      prims=dict(stance=sc,objects=[q for q in OBJ if P[q]>=0.5],qualifiers=[q for q in QUAL if P[q]>=0.5])))
for o in out: print(json.dumps(o))
