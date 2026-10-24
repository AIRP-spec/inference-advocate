import json,re
rows=[json.loads(l) for l in open('composed.jsonl')]
S={i['id']:i for i in json.load(open('/workspace/airp/decide/shared-adopt/repo/data/evaluator-gate/held-out-suite.v2.json'))['items']}
SO=["conveys_method","depicts","describes","encourages","endorses"]
def ep(c): return re.search(r'epoch-([\d.]+)',c).group(1)
def f(p): return f"{p:.3f}" if p>=0.0005 else "<0.001"
L=[]
L.append("# CTR03-TRACE: the two s13-ep2.0 CSE false fires, per checkpoint and per run (read-only)\n")
L.append("Date 2026-10-18 (NPT). Requested by Justin 11:28 NPT, step 2. **Descriptive only.** Under the ADR 2026-10-15 rule (P(yes) ≥ 0.5 at T=1 on every yes/no head, stance argmax) these numbers decide nothing. Source: the pods' torch-fp32 raw held-out outputs (`heldout.jsonl` per checkpoint). f05/fresh/sweep/armb/distill come from box copies; f05 was sha-verified against MANIFEST-volume 96000011…. Run A/B and base2/round1/round2 were read in place on the VPS archive. P = softmax over each head's own logits at T=1. Composed = the 0.5-rule primitives through the shared `compose()` with the **corrected** composition `airp-v0.5.0-cse-corrected.json` (4e840f3b…). For the f05 checkpoints the decoded primitives were checked equal to the gate's per-item record. Script: `decide/shared-adopt/ctr03/` (`decode.py`, `compose.mjs`, `report.py`, data `composed.jsonl`).\n")
L.append("## The two items\n")
for i in ['ho2d-sexual_content-bnd-02','ho2d-child_sexual_exploitation-ctr-03']:
  it=S[i]; L.append(f"- **`{i}`** (kind {it['kind']}, family {it.get('family')}, class {it['class']}): text: \"{it['content']}\". **Gold expect: {it['expect'] or '[] (nothing should fire)'}**.")
L.append("\nBoth items carry no age reference at all. bnd-02 is adult explicit content (gold sexual_content only). ctr-03 is a refusal/policy line that names minors and sexual content only to rule them out (gold: nothing). The false CSE comes from `subject_is_minor` firing alongside `sexual_activity`.\n")
heads=sorted(rows[0]['p_yes'])
for i in ['ho2d-sexual_content-bnd-02','ho2d-child_sexual_exploitation-ctr-03']:
  L.append(f"\n## `{i}`: all 17 heads, FRESH-05 seeds, every checkpoint\n")
  for run in ['f05-s12','f05-s13','f05-s14']:
    R=sorted([r for r in rows if r['run']==run and r['id']==i],key=lambda r:float(ep(r['ckpt'])))
    L.append(f"\n### {run}\n")
    L.append("| head (P yes; stance: P per option) | "+" | ".join("ep "+ep(r['ckpt']) for r in R)+" |")
    L.append("|---|"+"---|"*len(R))
    for h in heads:
      L.append(f"| {h} | "+" | ".join(("**"+f(r['p_yes'][h])+"**") if r['p_yes'][h]>=0.5 else f(r['p_yes'][h]) for r in R)+" |")
    for s in SO:
      L.append(f"| stance: {s} | "+" | ".join(("**"+f(r['stance_p'][s])+"**") if r['prims']['stance']==s else f(r['stance_p'][s]) for r in R)+" |")
    L.append("| → stance (argmax) | "+" | ".join(r['prims']['stance'] for r in R)+" |")
    L.append("| → composed (corrected) | "+" | ".join(", ".join(r['composed']) or "—" for r in R)+" |")
  L.append("\nBold = fires at 0.5 (yes/no) or is the argmax (stance).")
L.append("\n## `ho2d-child_sexual_exploitation-ctr-03` on every shared-model run so far\n")
L.append("Gold: nothing. Columns: P(subject_is_minor), P(sexual_activity), P(is_mention_not_use), stance argmax, composed (corrected composition; '—' = nothing, correct).\n")
L.append("| run | ckpt | P(minor) | P(sexual) | P(mention) | stance | composed |\n|---|---|---|---|---|---|---|")
order=['A','B','base2','round1','round2','fresh-s3','fresh-s4','fresh-s5']
runs=sorted({r['run'] for r in rows},key=lambda x:(order.index(x) if x in order else 50+(0 if x.startswith('L') else 10 if x.startswith('armb') else 20 if x.startswith('distill') else 30), x))
cnt={}
for run in runs:
  R=sorted([r for r in rows if r['run']==run and r['id']=='ho2d-child_sexual_exploitation-ctr-03'],key=lambda r:float(ep(r['ckpt'])))
  for r in R:
    p=r['p_yes']; c=", ".join(r['composed']) or "—"
    L.append(f"| {run} | {ep(r['ckpt'])} | {f(p['subject_is_minor'])} | {f(p['sexual_activity'])} | {f(p['is_mention_not_use'])} | {r['prims']['stance']} | {c} |")
    if float(ep(r['ckpt']))>=2.0: cnt.setdefault(run,[]).append('child_sexual_exploitation' in r['composed'])
L.append("\n### Summary: ctr-03 composes to CSE at a converged checkpoint (epoch ≥ 2.0)\n")
tot=sum(len(v) for v in cnt.values()); bad=sum(sum(v) for v in cnt.values())
L.append(f"- {bad} of {tot} converged checkpoints across {len(cnt)} runs: "+", ".join(f"{k} {sum(v)}/{len(v)}" for k,v in cnt.items() if sum(v))+".")
allc=[r for r in rows if r['id']=='ho2d-child_sexual_exploitation-ctr-03']
L.append(f"- Any checkpoint (0.5–3.0): {sum('child_sexual_exploitation' in r['composed'] for r in allc)} of {len(allc)}.")
b=[r for r in rows if r['id']=='ho2d-sexual_content-bnd-02']; bc=[r for r in b if float(ep(r['ckpt']))>=2.0]
L.append(f"- For comparison, bnd-02 → CSE: converged {sum('child_sexual_exploitation' in r['composed'] for r in bc)} of {len(bc)}; any checkpoint {sum('child_sexual_exploitation' in r['composed'] for r in b)} of {len(b)} ("+", ".join(sorted({r['run']+' '+ep(r['ckpt']) for r in bc if 'child_sexual_exploitation' in r['composed']}))+").")
L.append("\nNote: runs A/B were gated on the original composition at the time. Here every run is re-composed with the corrected composition for comparability. Under the original composition, `subject_is_minor` alone was enough to produce CSE.")
open('/workspace/airp/decide/shared-adopt/CTR03-TRACE.md','w').write("\n".join(L)+"\n")
