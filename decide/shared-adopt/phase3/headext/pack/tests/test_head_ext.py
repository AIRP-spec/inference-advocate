"""Head-extension CPU tests (no GPU, no data, no base weights; FakeEnc stub as tests/test_head_init.py).
  1. 25-head build: the first 17 head rows, the shared head layers and the encoder are identical to the 17-head build;
     the global RNG state after build is unchanged by the extension; the base sha recorded equals the 17-head sha.
  2. Cross-attention only: the 17 existing heads' logits are identical with and without the 8 appended heads.
  3. New heads come from a Generator seeded with head_init_seed: same seed -> identical, other seed -> different.
  4. weighted_losses with all weights 1 equals the P3-3 unweighted losses; weight 0 removes that head's gradient.
  5. soft_mix_partial mixes only covered rows and only the base heads.
  6. gold_target / is_excluded / head_weights (amendment 7: exclude, don't map) and the v10 questions pin."""
import json, random, sys, types
from pathlib import Path
import numpy as np
import torch
import torch.nn as nn
sys.modules.setdefault("laya", types.ModuleType("laya")); _m = types.ModuleType("laya.common"); _m.proper_reward = None; sys.modules["laya.common"] = _m
for _n in ("safetensors", "safetensors.torch", "transformers"):
    _x = sys.modules.setdefault(_n, types.ModuleType(_n))
    if not hasattr(_x, "save_file"): _x.save_file = None
    if not hasattr(_x, "AutoTokenizer"): _x.AutoTokenizer = None
PACK = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PACK))
import shared_model as SM
import train_shared as T
import common_shared as C


class FakeEnc(nn.Module):
    def __init__(self, d=64):
        super().__init__(); self.config = types.SimpleNamespace(hidden_size=d); self.emb = nn.Embedding(50, d)
        with torch.no_grad(): self.emb.weight.copy_(torch.arange(50 * d, dtype=torch.float32).reshape(50, d) / 1e3)

    def forward(self, input_ids=None, attention_mask=None):
        return types.SimpleNamespace(last_hidden_state=self.emb(input_ids))


def stub_load_base(model_dir, n_questions, head_layers=2, device="cpu"):
    torch.randn(1000)
    return SM.SharedModel(FakeEnc(), n_questions, head_layers=head_layers), {}


def build(seed, k, ext=0):
    torch.manual_seed(seed); np.random.seed(seed); random.seed(seed)
    m, _ = T.build_seeded(stub_load_base, "x", 17, 2, seed, k)
    base = T.init_state_sha256(m)
    if ext:
        T.extend_heads(m, ext, k)
    return m, base, (torch.get_rng_state().clone(), np.random.get_state()[1].copy(), random.getstate())


def test_slice_identical_and_rng_untouched():
    m17, b17, s17 = build(60, 7)
    m25, b25, s25 = build(60, 7, ext=8)
    assert b17 == b25 == T.init_state_sha256(m17)
    sd17, sd25 = m17.state_dict(), m25.state_dict()
    assert set(sd17) == set(sd25)
    for k, v in sd17.items():
        if k in ("queries", "out_w", "out_b"):
            assert sd25[k].shape[0] == 25 and torch.equal(sd25[k][:17], v), k
        else:
            assert torch.equal(sd25[k], v), k
    assert torch.equal(s17[0], s25[0]) and (s17[1] == s25[1]).all() and s17[2] == s25[2]
    assert m25.n_questions == 25 and torch.equal(sd25["out_b"][17:], torch.zeros(8, SM.KMAX))


def test_existing_heads_forward_unchanged():
    m17, _, _ = build(61, 7); m25, _, _ = build(61, 7, ext=8)
    m17.eval(); m25.eval()
    ids = torch.tensor([[1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 0, 0]]); att = torch.tensor([[1] * 6, [1] * 4 + [0, 0]])
    with torch.no_grad():
        a, b = m17(ids, att), m25(ids, att)
    assert b.shape == (2, 25, SM.KMAX) and torch.allclose(a, b[:, :17], atol=0, rtol=0)


def test_new_heads_seeded_separately():
    a, _, _ = build(60, 7, ext=8); b, _, _ = build(65, 7, ext=8); c, _, _ = build(60, 8, ext=8)
    assert torch.equal(a.queries[17:], b.queries[17:]) and torch.equal(a.out_w[17:], b.out_w[17:])
    assert not torch.equal(a.queries[17:], c.queries[17:])
    g = torch.Generator().manual_seed(7)
    assert torch.equal(a.queries[17:].detach(), torch.randn(8, 64, generator=g) * 0.02)


def _loss_inputs(n=3, Q=25, G=4):
    torch.manual_seed(0)
    logits = torch.randn(n * Q, SM.KMAX, requires_grad=True)
    mask = torch.zeros(n * Q, SM.KMAX, dtype=torch.bool); mask[:, :2] = True
    target = torch.softmax(torch.randn(n * Q, SM.KMAX).masked_fill(~mask, -1e4), -1)
    z = logits.detach().unsqueeze(0) + torch.randn(G, n * Q, SM.KMAX) * 0.25 * mask
    adv = torch.randn(G, n * Q)
    logp = -(((z - logits.unsqueeze(0)) ** 2) * mask).sum(-1) / (2 * 0.25 ** 2)
    return adv, logp, target, logits, mask


def test_weighted_losses_equal_when_ones_and_mask_when_zero():
    adv, logp, target, logits, mask = _loss_inputs()
    rl0 = -(adv * logp).mean(); ce0 = -(target * torch.log_softmax(logits.masked_fill(~mask, -1e4), -1)).sum(-1).mean()
    rl1, ce1 = T.weighted_losses(adv, logp, target, logits, mask, torch.ones(logits.shape[0]))
    assert torch.allclose(rl0, rl1, rtol=1e-6, atol=1e-6) and torch.allclose(ce0, ce1, rtol=1e-6, atol=1e-6)
    w = torch.ones(logits.shape[0]); w[25 + 20] = 0.0   # item 1, head 20 (a new head) excluded
    rl, ce = T.weighted_losses(adv, logp, target, logits, mask, w)
    (rl + ce).backward()
    assert torch.count_nonzero(logits.grad[25 + 20]) == 0 and torch.count_nonzero(logits.grad[25 + 19]) > 0


def test_soft_mix_partial():
    base = [f"q{i}" for i in range(17)]
    def item(rid):
        t = torch.zeros(25, SM.KMAX); t[:, 0] = 1.0
        return {"row_id": rid, "target": t}
    items = [item("old"), item("new")]
    soft = {"old": {q: [0.0, 1.0] for q in base}}
    assert T.soft_mix_partial(items, soft, base, 0.5) == 1
    assert torch.allclose(items[0]["target"][:17, :2], torch.tensor([[0.5, 0.5]] * 17))
    assert torch.equal(items[0]["target"][17:], item("x")["target"][17:])
    assert torch.equal(items[1]["target"], item("x")["target"])
    try:
        T.soft_mix_partial([item("old")], {"old": {q: [0.0, 1.0] for q in base[:16]}}, base, 0.5); raise RuntimeError("no assert")
    except AssertionError:
        pass


def test_gold_exclusion_and_questions_pin():
    qs = json.load(open(PACK / "data-v10" / "laya-questions-v10.json"))
    C.assert_questions_pin(qs)
    qids = list(qs)
    assert qids[17:] == C.EXT_HEADS and len(qids) == 25
    base = {q: qs[q] for q in qids[:17]}   # the 17 base questions, byte-for-byte the P3-3 pin
    import hashlib
    canon = json.dumps(base, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    assert hashlib.sha256(canon.encode("utf-8")).hexdigest() == C.QUESTIONS_CANONICAL_SHA256
    exc = C.load_excluded()
    old_cr = {"kind": "clean-redirect", "objects": [], "qualifiers": ["is_mention_not_use"], "stance": "describes"}
    old_rh = {"kind": "relational_hooks-blunt", "objects": [], "qualifiers": ["directed_at_user"], "stance": "encourages"}
    old_other = {"kind": "weather-chat", "objects": [], "qualifiers": [], "stance": "describes"}
    new_cr = {"kind": "cr-hotline-referral", "objects": [], "qualifiers": ["directed_at_user"], "stance": "encourages", "ext": {"refers_to_crisis_services": 1}}
    assert C.is_excluded("refers_to_crisis_services", old_cr, exc) and not C.is_excluded("advertises_product", old_cr, exc)
    assert C.is_excluded("claims_relationship_role", old_rh, exc) and not C.is_excluded("claims_relationship_role", old_other, exc)
    assert not C.is_excluded("refers_to_crisis_services", new_cr, exc)
    w = C.head_weights(qids, old_cr, exc)
    assert w[qids.index("refers_to_crisis_services")] == 0.0 and sum(w) == 24.0
    assert C.gold_target("refers_to_crisis_services", qs["refers_to_crisis_services"], new_cr) == [0.0, 1.0]
    assert C.gold_target("refers_to_crisis_services", qs["refers_to_crisis_services"], old_cr) == [1.0, 0.0]
    assert C.gold_target("directed_at_user", qs["directed_at_user"], new_cr) == [0.0, 1.0]
    assert json.load(open(C.EXCLUDED_KINDS_FILE))["mapped"] == {}


if __name__ == "__main__":
    fs = [test_slice_identical_and_rng_untouched, test_existing_heads_forward_unchanged, test_new_heads_seeded_separately,
          test_weighted_losses_equal_when_ones_and_mask_when_zero, test_soft_mix_partial, test_gold_exclusion_and_questions_pin]
    for f in fs:
        f(); print("PASS", f.__name__)
    print(f"ALL {len(fs)} PASS")
