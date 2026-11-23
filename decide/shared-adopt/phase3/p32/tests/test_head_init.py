"""P3-2 CPU test (no GPU, no data, no base weights): --head-init-seed in train_shared.py.
Uses the real SharedModel head code (shared_model.py) on a small stand-in encoder; load_base is replaced by a stub that,
like laya.common.build_model, first draws from the torch RNG for the base model's own layers, then builds the heads.
  1. same --head-init-seed, different --seed  -> byte-identical head tensors at step 0 (init_state_sha256 'head')
  2. different --head-init-seed               -> different heads
  3. default (unset) path == old inline code (manual_seed(seed); load_base): same tensors and same RNG state after
  4. with --head-init-seed, the torch/numpy/random state after build depends only on --seed (== fresh seed(seed))"""
import random, sys, types
from pathlib import Path
import numpy as np
import torch
import torch.nn as nn
sys.modules.setdefault("laya", types.ModuleType("laya")); _m = types.ModuleType("laya.common"); _m.proper_reward = None; sys.modules["laya.common"] = _m
for _n in ("safetensors", "safetensors.torch", "transformers"):
    _x = sys.modules.setdefault(_n, types.ModuleType(_n))
    if not hasattr(_x, "save_file"): _x.save_file = None
    if not hasattr(_x, "AutoTokenizer"): _x.AutoTokenizer = None
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import shared_model as SM
import train_shared as T

class FakeEnc(nn.Module):
    def __init__(self, d=64):
        super().__init__(); self.config = types.SimpleNamespace(hidden_size=d); self.emb = nn.Embedding(50, d)
        with torch.no_grad(): self.emb.weight.copy_(torch.arange(50 * d, dtype=torch.float32).reshape(50, d) / 1e3)  # fixed "pretrained" tensor

def stub_load_base(model_dir, n_questions, head_layers=2, device="cpu"):
    torch.randn(1000)  # build_model's own random layers before load_state_dict
    return SM.SharedModel(FakeEnc(), n_questions, head_layers=head_layers), {}

def build(seed, k):
    torch.manual_seed(seed); np.random.seed(seed); random.seed(seed)   # as train_shared.main
    m, _ = T.build_seeded(stub_load_base, "x", 17, 2, seed, k)
    return m, (torch.get_rng_state().clone(), np.random.get_state()[1].copy(), random.getstate())

def test_same_k_identical():
    a, _ = build(45, 7); b, _ = build(49, 7)
    assert T.init_state_sha256(a)["head"] == T.init_state_sha256(b)["head"]
    assert T.init_state_sha256(a)["full"] == T.init_state_sha256(b)["full"]
    for (ka, va), (kb, vb) in zip(sorted(a.state_dict().items()), sorted(b.state_dict().items())):
        assert ka == kb and torch.equal(va, vb), ka

def test_different_k_differs():
    a, _ = build(45, 7); b, _ = build(45, 8)
    assert T.init_state_sha256(a)["head"] != T.init_state_sha256(b)["head"]
    c, _ = build(45, None); d, _ = build(46, None)   # old behaviour: heads follow the run seed
    assert T.init_state_sha256(c)["head"] != T.init_state_sha256(d)["head"]

def test_default_path_is_old_code():
    m, st = build(45, None)
    torch.manual_seed(45); np.random.seed(45); random.seed(45)
    o, _ = stub_load_base("x", 17, head_layers=2)
    assert T.init_state_sha256(m) == T.init_state_sha256(o)
    assert torch.equal(st[0], torch.get_rng_state()) and (st[1] == np.random.get_state()[1]).all() and st[2] == random.getstate()

def test_rng_after_depends_on_seed_only():
    _, s1 = build(45, 7); _, s2 = build(45, 8)
    torch.manual_seed(45); np.random.seed(45); random.seed(45)
    for s in (s1, s2):
        assert torch.equal(s[0], torch.get_rng_state()) and (s[1] == np.random.get_state()[1]).all() and s[2] == random.getstate()

if __name__ == "__main__":
    for f in (test_same_k_identical, test_different_k_differs, test_default_path_is_old_code, test_rng_after_depends_on_seed_only):
        f(); print("PASS", f.__name__)
