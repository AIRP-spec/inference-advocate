#!/usr/bin/env python3
"""FRESH-06 data build (Justin approved the 40 r15 rows 2026-10-18 12:40 NPT).
corpus v6 = corpus v5 + 40 r15 rows (corpus format); kind table v6 = v5 table + 4 r15 entries (proposed-kind-table-additions.json);
labels v6 = relabel-from-slots.mjs over corpus v6 (run by build_v6.sh); train v6 = train v5 + the 40 rows (train only); val unchanged."""
import json, hashlib, sys
S='/workspace/airp/decide/shared-adopt'
CLASSES=['persona_claims','relational_hooks','sycophancy','simulation_obscured','profanity','self_harm','sexual_content','child_sexual_exploitation','violence','hate','criminal_assistance']
GROUP={'r15-sx-terse-crude':('r15-cse-shape-sx','crude'),'r15-sx-terse-plain':('r15-cse-shape-sx','plain'),
       'r15-refuse-terse-adult':('r15-cse-shape-refuse','adult'),'r15-refuse-terse-minor-nonsexual':('r15-cse-shape-refuse','minor-nonsexual')}
def jl(p): return [json.loads(l) for l in open(p) if l.strip()]
rows=jl(f'{S}/draft-cse-shape-rows/rows-draft.jsonl'); assert len(rows)==40
add=json.load(open(f'{S}/draft-cse-shape-rows/proposed-kind-table-additions.json'))['table']
step=sys.argv[1]
if step=='pre':
    kt=json.load(open('tooltree/tools/evaluator-training/primitives/kind-label-table.json'))
    for k,v in add.items(): assert k not in kt['table']; kt['table'][k]=v
    kt['note']=kt.get('note','')+' | r15 CSE-shape kinds added for FRESH-06 (Justin approved 2026-10-18 12:40 NPT).'
    json.dump(kt,open('tooltree/tools/evaluator-training/primitives/kind-label-table.json','w'),indent=2,ensure_ascii=False); open('tooltree/tools/evaluator-training/primitives/kind-label-table.json','a').write('\n')
    corp=open(f'{S}/work/gen/corpus.jsonl').read()
    ids={json.loads(l)['id'] for l in corp.splitlines() if l.strip()}
    out=[]
    for r in rows:
        assert r['id'] not in ids; e=add[r['kind']]
        assert (r['stance'],r['objects'],r['qualifiers'],r['expect'])==(e['stance'],e['objects'],e['qualifiers'],e['expect'])
        g,arm=GROUP[r['kind']]; sx=bool(r['expect'])
        out.append({'id':r['id'],'family':'positive-composed' if sx else 'sensitive-discussion','class':'sexual_content' if sx else None,'kind':r['kind'],
          'path':'composed','contrastGroup':g,'arm':arm,'expect':r['expect'],'content':r['content'],'taxonomyVersion':'v0.5.0','promptTemplateVersion':'v3',
          'verdict':' '.join('yes' if c in r['expect'] else 'no' for c in CLASSES)})
    with open('corpus-v6.jsonl','w') as f:
        f.write(corp if corp.endswith('\n') else corp+'\n')
        for o in out: f.write(json.dumps(o)+'\n')
    print('corpus-v6', len(ids)+40)
elif step=='post':
    lab={r['id']:r for r in jl('labels-v6.jsonl')}; v5={r['id']:r for r in jl(f'{S}/work/labels-v5.jsonl')}
    assert len(lab)==8192 and set(v5)<=set(lab)
    assert all(lab[i]==v5[i] for i in v5), 'existing labels changed'
    new=[i for i in lab if i not in v5]; assert sorted(new)==sorted(r['id'] for r in rows)
    corp={r['id']:r for r in jl('corpus-v6.jsonl')}
    with open('train-v6.jsonl','w') as f:
        f.write(open(f'{S}/work/split/train.jsonl').read())
        for r in rows:
            L=lab[r['id']]; assert (L['stance'],L['objects'],L['qualifiers'])==(r['stance'],r['objects'],r['qualifiers']), r['id']
            c=dict(corp[r['id']]); o={k:c[k] for k in ('id','family','class','expect','content','taxonomyVersion','promptTemplateVersion','verdict')}
            o.update(stance=L['stance'],objects=L['objects'],qualifiers=L['qualifiers'],tiebreaker=L['tiebreaker'],reason=L['reason'],kind=L['kind'],state=c['content'],contrastGroup=c['contrastGroup'],arm=c['arm'],path='composed')
            f.write(json.dumps(o)+'\n')
    tr=jl('train-v6.jsonl'); va=jl(f'{S}/work/split/val.jsonl')
    assert len(tr)==7372 and len({r['id'] for r in tr})==7372 and not ({r['id'] for r in tr}&{r['id'] for r in va})
    vt={r['content'].strip().lower() for r in va}; assert not any(r['content'].strip().lower() in vt for r in tr[-40:])
    h=lambda p: hashlib.sha256(open(p,'rb').read()).hexdigest()
    meta=json.load(open(f'{S}/work/split/split-meta.json'))
    meta.update(splitVersion='laya-airp-group-v1+r13-train-only+r15-train-only', labels_sha256_v5=meta['labels_sha256'], labels_sha256=h('labels-v6.jsonl'),
      corpus_sha256_v5=meta['corpus_sha256'], corpus_sha256=h('corpus-v6.jsonl'), train_n=7372, train_sha256_v5=meta['train_sha256'], train_sha256=h('train-v6.jsonl'),
      new_r15_rows=40, new_units_to_train=meta['new_units_to_train']+['g:r15-cse-shape-refuse','g:r15-cse-shape-sx'],
      kind_table_sha256=h('tooltree/tools/evaluator-training/primitives/kind-label-table.json'),
      decision='Justin 2026-10-18 12:40 NPT: 40 r15 CSE-shape rows approved; train only; teacher targets from ens5 (draft declaration default)')
    json.dump(meta,open('split-meta-v6.json','w'),indent=2); open('split-meta-v6.json','a').write('\n')
    print('OK train',len(tr),'labels',len(lab),'val',len(va))
