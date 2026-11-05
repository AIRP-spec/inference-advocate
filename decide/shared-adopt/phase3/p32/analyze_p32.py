#!/usr/bin/env python3
"""P3-2 analyzer (DECLARATION-P3-2). Validation only. Applies the declared rules to the pod's val raw outputs.
  analyze_p32.py POD_OUT_DIR VAL COMPOSITION OUT_DIR
POD_OUT_DIR = box copy of /workspace/p32/out (raw/, raw-avg/, raw-x/, conv/) plus ../logs (training-meta-*.json)."""
import itertools, json, statistics as st, subprocess, sys, datetime, hashlib
from pathlib import Path
HERE = Path(__file__).resolve().parent
OUT, VAL, COMP, W = (Path(x) for x in sys.argv[1:5]); W.mkdir(parents=True, exist_ok=True)
H0 = [40, 41, 42, 43, 44]; H1 = [45, 46, 47, 48, 49]; TOL = 0.02
SEEDS = {"H0": H0, "H1": H1}

def first(d, e):
    c = sorted(p for p in d.glob(f"ckpt-epoch-{e}-*") if p.is_dir()); return c[0] if c else None

models = {}
for arm, ss in SEEDS.items():
    for s in ss:
        models[f"{arm}-end-s{s}"] = OUT / "raw-x" / f"{arm}-end-s{s}"
    for i, j in itertools.combinations(ss, 2):
        models[f"{arm}-mid-s{i}-s{j}"] = OUT / "raw-x" / f"{arm}-mid-s{i}-s{j}"
    models[f"{arm}-soup5"] = OUT / "raw-x" / f"{arm}-soup5"
if (OUT / "raw-x" / "H1-soup-artifacts" / "val.jsonl").exists():
    models["H1-soup-artifacts"] = OUT / "raw-x" / "H1-soup-artifacts"
for s in H1:
    R = f"p32-H1-s{s}"
    models[f"H1-artifact-s{s}"] = OUT / "raw-avg" / R / f"avg-{R}-ge2.0"
    for e in ("2.0", "2.5", "3.0", "3.5", "4.0"):
        c = first(OUT / "raw" / R, e)
        if c: models[f"H1-ep{e}-s{s}"] = c
missing = [k for k, p in models.items() if not (p / "val.jsonl").exists()]
if missing:
    print("NO_VALID_OUTPUT missing:", missing); sys.exit(3)
cmd = [sys.executable, str(HERE / "p32_val.py"), "--val", str(VAL), "--composition", str(COMP)] + [f"{k}={p}" for k, p in models.items()]
scores = json.loads(subprocess.run(cmd, check=True, capture_output=True, text=True).stdout)
(W / "p32-val-scores.json").write_text(json.dumps(scores, indent=1) + "\n")
M = scores["models"]

# R0 technical precondition: identical H1 head init
metas = {s: json.load(open(OUT.parent / "logs" / f"training-meta-p32-H1-s{s}.json")) for s in H1}
heads = {m["init_head_sha256"] for m in metas.values()}; fulls = {m["init_full_sha256"] for m in metas.values()}
r0 = dict(pass_=len(heads) == 1 and all(m["head_init_seed"] == 7 for m in metas.values()), init_head_sha256=sorted(heads),
          init_full_sha256=sorted(fulls), seeds={s: m["seed"] for s, m in metas.items()})

# R1 validity per arm
r1 = {}
for arm, ss in SEEDS.items():
    pairs = {}
    for i, j in itertools.combinations(ss, 2):
        a, b, m = M[f"{arm}-end-s{i}"], M[f"{arm}-end-s{j}"], M[f"{arm}-mid-s{i}-s{j}"]
        worse_loss = max(a["val_loss"], b["val_loss"]); worse_f1 = min(a["macro_f1"], b["macro_f1"])
        ok_l = m["val_loss"] <= worse_loss + TOL; ok_f = m["macro_f1"] >= worse_f1 - TOL
        pairs[f"s{i}-s{j}"] = dict(mid_loss=round(m["val_loss"], 5), worse_end_loss=round(worse_loss, 5), loss_barrier=round(m["val_loss"] - worse_loss, 5),
                                   mid_f1=round(m["macro_f1"], 5), worse_end_f1=round(worse_f1, 5), f1_drop=round(worse_f1 - m["macro_f1"], 5),
                                   loss_ok=ok_l, f1_ok=ok_f, pass_=ok_l and ok_f)
    ing = [M[f"{arm}-end-s{s}"]["macro_f1"] for s in ss]; soup = M[f"{arm}-soup5"]["macro_f1"]
    soup_ok = soup >= st.mean(ing)
    r1[arm] = dict(pairs=pairs, pairs_passed=f"{sum(p['pass_'] for p in pairs.values())}/{len(pairs)}", soup_f1=round(soup, 5),
                   soup_loss=round(M[f"{arm}-soup5"]["val_loss"], 5), ingredient_f1_mean=round(st.mean(ing), 5),
                   ingredient_f1=[round(x, 5) for x in ing], soup_ge_mean=soup_ok, valid=all(p["pass_"] for p in pairs.values()) and soup_ok)

# R3 cross-seed soup vs within-run averaging (H1 only, only if R0 and R1[H1] hold)
def serr(x): return len(x["cse_miss"]) + len(x["cse_extra"]) + len(x["sh_class_miss"]) + len(x["sh_prim_miss"])
art = {s: M[f"H1-artifact-s{s}"] for s in H1}; sp = M["H1-soup5"]
per_seed = {f"s{s}": dict(artifact_f1=round(a["macro_f1"], 5), soup_f1=round(sp["macro_f1"], 5), soup_f1_ge=sp["macro_f1"] >= a["macro_f1"],
                          artifact_safety_errors=serr(a), soup_safety_errors=serr(sp), soup_safety_le=serr(sp) <= serr(a)) for s, a in art.items()}
evaluated = r0["pass_"] and r1["H1"]["valid"]
wins = evaluated and all(v["soup_f1_ge"] and v["soup_safety_le"] for v in per_seed.values())
r3 = dict(evaluated=evaluated, per_seed=per_seed, k_soup_f1_ge=f"{sum(v['soup_f1_ge'] for v in per_seed.values())}/5",
          k_soup_safety_le=f"{sum(v['soup_safety_le'] for v in per_seed.values())}/5",
          worst_seed_artifact_f1=round(min(a["macro_f1"] for a in art.values()), 5), soup_f1=round(sp["macro_f1"], 5),
          outcome=("cross-seed soup (H1, 5 finals) replaces within-run averaging as the artifact rule" if wins else
                   "within-run averaging (ep >= 2.0) stays the artifact rule" + ("" if evaluated else " (R3 not evaluated: precondition failed)")))

# Reporting (not gated): val safety per artifact / checkpoint, flips, H1 vs P3-1 A2 (unpaired seeds)
rep = {}
for k, v in M.items():
    rep[k] = dict(f1=round(v["macro_f1"], 4), loss=round(v["val_loss"], 4), stance=round(v["stance_accuracy"], 4), cse_miss=len(v["cse_miss"]), cse_extra=len(v["cse_extra"]),
                  sh_class_miss=len(v["sh_class_miss"]), sh_prim_miss=len(v["sh_prim_miss"]), val_safety_clean=v["val_safety_clean"])
flips = {s: json.load(open(OUT / "conv" / f"p32-H1-s{s}.json")) for s in H1}
af = [a["macro_f1"] for a in art.values()]
res = dict(declaration="DECLARATION-P3-2.md", val_sha256=scores["val_sha256"], safety_gold_counts=scores["safety_gold_counts"],
           R0_head_init=r0, R1_validity=r1, R3_soup_vs_within_run=r3,
           report=dict(H1_artifact_f1_mean=round(st.mean(af), 4), H1_artifact_f1_sd=round(st.stdev(af), 4), H1_artifact_f1_range=[round(min(af), 4), round(max(af), 4)],
                       flips={s: dict(flips=v["flips"], converged=v["converged"]) for s, v in flips.items()}, per_model=rep),
           timestamp_utc=datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))
p = W / "P3-2-RESULT.json"; p.write_text(json.dumps(res, indent=1, default=str) + "\n")
print("R0 head init identical:", r0["pass_"], r0["init_head_sha256"])
for arm in SEEDS: print(f"R1 {arm}: pairs {r1[arm]['pairs_passed']} soup {r1[arm]['soup_f1']} vs mean {r1[arm]['ingredient_f1_mean']} -> VALID={r1[arm]['valid']}")
print("R3:", r3["outcome"], "| soup>=artifact", r3["k_soup_f1_ge"], "| safety<=", r3["k_soup_safety_le"])
print("RESULT", p, hashlib.sha256(p.read_bytes()).hexdigest())
