"""CPU test (no GPU, no data): LR and sigma traces of train_shared.py (P3-1) vs the aab483c2 inline code."""
import math, sys, types, argparse
from pathlib import Path
import torch
sys.modules.setdefault("laya", types.ModuleType("laya")); m = types.ModuleType("laya.common"); m.proper_reward = None; sys.modules["laya.common"] = m
for _n in ("safetensors", "safetensors.torch", "transformers"):
    _m = sys.modules.setdefault(_n, types.ModuleType(_n)); _m.save_file = None; _m.AutoTokenizer = None
sm = types.ModuleType("shared_model"); sm.KMAX = 5; sm.SharedModel = sm.load_base = None; sys.modules["shared_model"] = sm
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import train_shared as T

SPE = 233  # steps/epoch for 7440 rows, micro 8 x accum 4
def ns(**kw):
    d = dict(lr_schedule="cosine", eta_min=1e-6, cosine_epochs=None, warmup_frac=0.0, sigma_start=0.25, sigma_end=0.1, ckpt_every_epochs=0.5); d.update(kw)
    return argparse.Namespace(**d)
def opt():
    p = [torch.nn.Parameter(torch.zeros(1)), torch.nn.Parameter(torch.zeros(1))]
    return torch.optim.AdamW([{"params": [p[0]], "lr": 2e-5}, {"params": [p[1]], "lr": 1e-4}])
def trace(sched, o, n):
    out = []
    for _ in range(n):
        out.append(tuple(g["lr"] for g in o.param_groups)); o.step(); sched.step()
    return out
def old_trace(EPOCHS, n):
    o = opt(); _T = max(1, SPE * int(math.ceil(EPOCHS)))
    return trace(torch.optim.lr_scheduler.CosineAnnealingLR(o, T_max=_T, eta_min=1e-6), o, n)
def old_sigma(epoch_f, EPOCHS, a):
    progress = min(1.0, epoch_f / max(1e-9, EPOCHS - a.ckpt_every_epochs)); return a.sigma_start + (a.sigma_end - a.sigma_start) * progress

def test_default_identical():
    a = ns(); o = opt(); n = SPE * 3
    assert trace(T.make_scheduler(o, a, SPE, 3.0), o, n) == old_trace(3.0, n)
    for e in (0.0, 1.0, 2.0): assert T.sigma_at(e, a, 3.0) == old_sigma(e, 3.0, a)

def test_a1_tail():
    a = ns(lr_schedule="cosine_tail", cosine_epochs=3.0); o = opt(); n = SPE * 4
    tr = trace(T.make_scheduler(o, a, SPE, 4.0), o, n); old = old_trace(3.0, SPE * 3)
    assert all(abs(x - y) <= 1e-12 * max(1, abs(y)) for p, q in zip(tr[:SPE * 3], old) for x, y in zip(p, q))
    assert all(abs(lr - 1e-6) < 1e-15 for p in tr[SPE * 3:] for lr in p)
    assert [round(T.sigma_at(e, a, 4.0), 6) for e in (0, 1, 2, 3)] == [0.25, 0.19, 0.13, 0.1]

def test_a2_cosine_to_zero():
    a = ns(eta_min=0.0); o = opt(); n = SPE * 4
    tr = trace(T.make_scheduler(o, a, SPE, 4.0), o, n + 1)
    assert tr[0] == (2e-5, 1e-4) and tr[-1][0] < 1e-15
    assert [round(T.sigma_at(e, a, 4.0), 6) for e in (0, 1, 2, 3)] == [0.25, round(0.25 - 0.15 / 3.5, 6), round(0.25 - 0.3 / 3.5, 6), round(0.25 - 0.45 / 3.5, 6)]

if __name__ == "__main__":
    for f in (test_default_identical, test_a1_tail, test_a2_cosine_to_zero): f(); print("PASS", f.__name__)
