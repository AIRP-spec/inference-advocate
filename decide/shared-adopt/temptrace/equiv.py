"""VAL-ONLY checks. (a) scorer consistency: primitives written by fit_secondary == laya_raw_to_primitives.decide_row(T, thr) on the same raw.
(b) T-invariance: thresholds refit at T=1 give identical val decisions to fitted-T + thresholds refit at that T.
(c) what the fitted thresholds are in logit-margin terms (z_yes - z_no), vs the 0.5 default (margin 0)."""
import json,sys,importlib.util,glob,os,math
import numpy as np
sys.path.insert(0,'/workspace/airp/decide/shared-adopt/pack-distill'); import fit_secondary as F
spec=importlib.util.spec_from_file_location('l','/workspace/airp/decide/step4/scripts/laya_raw_to_primitives.py'); L=importlib.util.module_from_spec(spec); spec.loader.exec_module(L)
val={json.loads(l)['id']:json.loads(l) for l in open('/workspace/airp/decide/shared-adopt/pack-distill/data-v5/val.jsonl')}
fits=json.load(open('fits/secondary-fits.json')); Q=F.OBJECTS+F.QUALS; out={}
for run,fz in sorted(fits.items()):
  vr=[json.loads(l) for l in open(f'raw/{run}/val.jsonl')]
  wrote={json.loads(l)['id']:json.loads(l) for l in open(f'fits/primary-secondary/{run}/val-primitives.jsonl')}
  a=sum(1 for r in vr if (lambda d:(sorted(d['objects']),sorted(d['qualifiers']),d['stance']))(L.decide_row(r,fz['thresholds'],fz['T_noul'],fz['T_stance']))!=(sorted(wrote[r['id']]['objects']),sorted(wrote[r['id']]['qualifiers']),wrote[r['id']]['stance']))
  lab={q:[int(q in set(val[r['id']].get('objects') or [])|set(val[r['id']].get('qualifiers') or [])) for r in vr] for q in Q}
  sc1={q:[float(F.softmax(r['logits'][q],1.0)[1]) for r in vr] for q in Q}
  th1={q:(F.best_f1_threshold(sc1[q],lab[q]) if sum(lab[q]) else 0.5) for q in Q}
  b=0
  for i,r in enumerate(vr):
    for q in Q:
      d1=sc1[q][i]>=th1[q]; dT=float(F.softmax(r['logits'][q],fz['T_noul'])[1])>=fz['thresholds'][q]
      b+=d1!=dT
  marg={q:round(fz['T_noul']*math.log(t/(1-t)),2) if 0<t<1 else ('-inf' if t<=0 else 'inf') for q,t in fz['thresholds'].items()}
  # val effect of fitted thresholds vs 0.5@T=1 on positives
  fn05=sum(1 for q in Q for i in range(len(vr)) if lab[q][i] and sc1[q][i]<0.5); fnF=sum(1 for q in Q for i,r in enumerate(vr) if lab[q][i] and float(F.softmax(r['logits'][q],fz['T_noul'])[1])<fz['thresholds'][q])
  fp05=sum(1 for q in Q for i in range(len(vr)) if not lab[q][i] and sc1[q][i]>=0.5); fpF=sum(1 for q in Q for i,r in enumerate(vr) if not lab[q][i] and float(F.softmax(r['logits'][q],fz['T_noul'])[1])>=fz['thresholds'][q])
  out[run]=dict(T_stance=round(fz['T_stance'],3),T_noul=round(fz['T_noul'],3),scorer_mismatch_rows=a,T_invariance_decision_diffs=b,thr_logit_margin=marg,val_FN_0p5=fn05,val_FN_fitted=fnF,val_FP_0p5=fp05,val_FP_fitted=fpF)
  print(run,out[run]['T_stance'],out[run]['T_noul'],'scorer_mismatch',a,'Tinv_diffs',b,'valFN 0.5/fit',fn05,fnF,'valFP',fp05,fpF)
json.dump(out,open('equiv.json','w'),indent=1)
print('distill-s10 margins',out['distill-s10']['thr_logit_margin']); print('fresh-s5 margins',out['fresh-s5']['thr_logit_margin'])
