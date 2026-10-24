#!/usr/bin/env python3
"""FRESH-06 step 2: control comparison (8 v5 rows recomputed vs 7a428e8d) and merge v5 teacher + 40 r15 rows -> ens5-train-soft-v6.jsonl."""
import json, hashlib
S='/workspace/airp/decide/shared-adopt'
def jl(p): return [json.loads(l) for l in open(p) if l.strip()]
old=jl(f'{S}/pack-f05/teacher/ens5-train-soft.jsonl'); O={r['row_id']:r['soft'] for r in old}
ctl=jl('control-v5-rows-soft.jsonl'); md=0.0; exact=0
for r in ctl:
    a=O[r['row_id']]; b=r['soft']; assert set(a)==set(b)
    d=max(abs(x-y) for q in a for x,y in zip(a[q],b[q])); md=max(md,d); exact+=int(a==b)
print(f'CONTROL rows={len(ctl)} bit_exact={exact} max_abs_diff={md:.3e}')
new=jl('r15-train-rows-soft.jsonl'); tr=jl('train-v6.jsonl'); r15=[r['id'] for r in tr[-40:]]
assert [r['row_id'] for r in new]==r15 and all(set(r['soft'])==set(old[0]['soft']) for r in new)
for r in new:
    for q,v in r['soft'].items(): assert len(v)==len(old[0]['soft'][q]) and abs(sum(v)-1)<1e-5
with open('ens5-train-soft-v6.jsonl','w') as f:
    f.write(open(f'{S}/pack-f05/teacher/ens5-train-soft.jsonl').read())
    f.write(open('r15-train-rows-soft.jsonl').read())
m=[r['row_id'] for r in jl('ens5-train-soft-v6.jsonl')]; ids=[r['id'] for r in tr]
val={r['id'] for r in jl(f'{S}/work/split/val.jsonl')}
assert len(m)==7372 and len(set(m))==7372 and set(m)==set(ids) and not (set(m)&val) and not any(i.startswith(('v0-','ho')) for i in m)
print('MERGED rows',len(m),'== train-v6 ids exactly; 0 val; 0 held-out; sha',hashlib.sha256(open('ens5-train-soft-v6.jsonl','rb').read()).hexdigest())
# descriptive: teacher P(yes) on key heads for r15 rows, mean per kind
import collections
K=collections.defaultdict(list); kind={r['id']:r['kind'] for r in tr[-40:]}
for r in new: K[kind[r['row_id']]].append(r['soft'])
for k,v in K.items(): print(k, {q: round(sum(s[q][1] for s in v)/len(v),3) for q in ('subject_is_minor','sexual_activity','is_mention_not_use')}, 'stance', [round(sum(s['stance'][i] for s in v)/len(v),2) for i in range(5)])
