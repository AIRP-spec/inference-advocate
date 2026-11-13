"""P3-3 declared extra outputs (A2 §7 items 2-6), ids/counts only: offer-row stance agreement with gold, self_harm primitive
misses, per-row miss frequency across the 10 artifacts, macro-F1 spread, 5 % flip summary.  usage: OUT VAL SCORES CONV > json"""
import json, sys, statistics as st, collections
sys.path.insert(0, __file__.rsplit('/', 2)[0] + '/p32'); sys.path.insert(0, '/workspace/airp/decide/shared-adopt/p32/pack')
from airp_v3.compose import STANCES
out, val, scores, conv = sys.argv[1:5]
rows = [json.loads(l) for l in open(val)]
offer = {r["id"]: r["stance"] for r in rows if r.get("kind") == "self-harm-named-method-offer"}
S = json.load(open(scores))["models"]; C = json.load(open(conv))["per_seed"]
seeds = list(range(50, 60)); res = {"offer_rows": len(offer), "offer_gold_stances": dict(collections.Counter(offer.values()))}
agree, f1 = {}, {}
for s in seeds:
    R = f"p33-s{s}"; n = 0
    for l in open(f"{out}/raw-avg/{R}/avg-{R}-ge2.0/val.jsonl"):
        rec = json.loads(l)
        if rec["id"] in offer:
            lg = rec["logits"]["stance"]; n += STANCES[max(range(len(lg)), key=lg.__getitem__)] == offer[rec["id"]]
    agree[s] = n; f1[s] = S[f"artifact-s{s}"]["macro_f1"]
res["offer_stance_agree_per_seed"] = agree
res["sh_prim_miss_per_seed"] = {s: len(S[f"artifact-s{s}"]["sh_prim_miss"]) for s in seeds}
res["sh_prim_miss_offer_per_seed"] = {s: sum(i in offer for i in S[f"artifact-s{s}"]["sh_prim_miss"]) for s in seeds}
res["stance_accuracy_per_seed"] = {s: round(S[f"artifact-s{s}"]["stance_accuracy"], 4) for s in seeds}
for key in ("cse_miss", "sh_class_miss", "sh_class_extra", "cse_extra"):
    c = collections.Counter(i for s in seeds for i in S[f"artifact-s{s}"][key]); res[f"freq_{key}"] = dict(sorted(c.items(), key=lambda x: (-x[1], x[0])))
v = list(f1.values()); res["macro_f1"] = {"mean": round(st.mean(v), 4), "sd": round(st.stdev(v), 4), "min": round(min(v), 4), "max": round(max(v), 4)}
res["conv"] = {s: {"converged": C[f"p33-s{s}"]["converged"], "flip_4.0": C[f"p33-s{s}"]["flips"]["4.0"]} for s in seeds}
json.dump(res, sys.stdout, indent=1)
