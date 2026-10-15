import json,glob,os,subprocess,re,collections
SA='/workspace/airp/decide/shared-adopt'; R=SA+'/rescore'
C=SA+'/repo/tools/evaluator-training/primitives/compositions/airp-v0.5.0-cse-corrected.json'
env=dict(os.environ,AIRP_REPO='/workspace/wt29',AIRP_COMPOSITION=C,AIRP_COMPOSITION_SHA='4e840f3b77c4a15fca46bc1bb537e5d4f3f6cbe37e4dde94d4e5d411f585be38')
suite=json.load(open(SA+'/repo/data/evaluator-gate/held-out-suite.v2.json'))['items']
P=json.load(open(SA+'/repo/tools/evaluator-training/primitives/gold-proxies.v0.5.0.settled.json'))['primitives']
gsh=lambda it:any(c in it['expect'] for c in P['object:self_harm']['expectIncludes'])
gao=lambda it:any(c in it['expect'] for c in P['qualifier:addresses_own_nature']['expectIncludes'])
src=[]
for d in glob.glob('/workspace/airp/decide/followup/shared/offline/primary/A-*'): src.append(('A',d))
for d in glob.glob(SA+'/offline/primary/*'): src.append((os.path.basename(d).split('-ckpt')[0],d))
for d in glob.glob(SA+'/sweep/off/primary/*'): src.append((os.path.basename(d).split('-ckpt')[0],d))
sel={'A':'2.5','base2':'1.5','round1':'1.5','round2':'2.0'}
for st,v in json.load(open(SA+'/sweep/off/summary.json'))['settings'].items():
    for sd,r in v['seeds'].items(): sel[f'{st}-s{sd}']=r['selected']['ckpt'].split('epoch-')[1].split('-')[0]
cse_ids=[it['id'] for it in suite if 'child_sexual_exploitation' in it['expect']]
out=[]
for run,d in sorted(src):
    ep=d.split('epoch-')[1].split('-')[0]
    if float(ep)<2.0 and sel[run]!=ep: continue
    o=f"{R}/gate-{run}-{ep}.json"
    if not os.path.exists(o):
        subprocess.run(['node','/workspace/airp/decide/step4/scripts/gate-from-primitives-comp.mjs','--primitives',d+'/heldout-primitives.jsonl','--label',f'{run}-{ep}','--out',o],env=env,check=True,capture_output=True)
    g=json.load(open(o)); pr={json.loads(l)['id']:json.loads(l) for l in open(d+'/heldout-primitives.jsonl')}
    shfn=sum(1 for it in suite if gsh(it) and 'self_harm' not in pr[it['id']]['objects'])
    aofp=sum(1 for it in suite if not gao(it) and 'addresses_own_nature' in pr[it['id']]['qualifiers'])
    nosa=[i for i in cse_ids if 'sexual_activity' not in pr[i]['objects']]
    out.append(dict(run=run,ep=ep,sel=sel[run]==ep,v2E=g['v2']['extras'],v2M=g['v2']['recallMisses'],v2EM=g['v2']['extras']+g['v2']['recallMisses'],
      cse=g['cse'],cse_extra=[r['id'] for r in g['extraRows'] if 'child_sexual_exploitation' in r['extra']],
      cse_miss=[r['id'] for r in g['recallFailures'] if 'child_sexual_exploitation' in r['missing']],shFN=shfn,aonFP=aofp,cse_gold_no_sa=nosa))
json.dump(out,open(R+'/rescore.json','w'),indent=1)
print(len(out))
