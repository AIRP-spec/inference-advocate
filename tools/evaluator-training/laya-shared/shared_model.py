"""Task 3b shared-encoding model: encode the response ONCE, read it with 17 question heads.

Input per response:  [CLS] response [SEP]        (no question text; each question is a head)
Encoder:             ModernBERT-large, starting from the encoder tensors of the Laya base snapshot
Heads:               17 learned queries -> 2-layer cross-attention decoder over the encoder states
                     -> shared scorer trunk -> one output layer per question (stance 5-way, noul 2-way [false, true]).
"""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Dict, List, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F

QTYPE = {"choice": 0, "score": 1, "noul": 2}
KMAX = 5


def question_spec(questions: Dict) -> Tuple[List[str], List[int], List[int]]:
    """(qids in file order, qtype per question, number of options per question)."""
    qids = list(questions.keys())
    qtypes, widths = [], []
    for qid in qids:
        q = questions[qid]
        t = q["type"]
        if t == "choice":
            widths.append(len(q["criteria"]))
        elif t == "noul":
            widths.append(2)
        else:
            raise ValueError(f"unsupported question type {t} for {qid}")
        qtypes.append(QTYPE[t])
    assert max(widths) <= KMAX
    return qids, qtypes, widths


class CrossLayer(nn.Module):
    """Pre-norm cross-attention (queries read encoder states) + FFN."""

    def __init__(self, d: int, nhead: int, dropout: float):
        super().__init__()
        self.nhead, self.hd = nhead, d // nhead
        self.nq, self.nkv, self.nf = nn.LayerNorm(d), nn.LayerNorm(d), nn.LayerNorm(d)
        self.q, self.k, self.v, self.o = (nn.Linear(d, d) for _ in range(4))
        self.ff = nn.Sequential(nn.Linear(d, 4 * d), nn.GELU(), nn.Linear(4 * d, d))
        self.drop = nn.Dropout(dropout)

    def forward(self, x, h, key_mask):
        # x [B,Q,d]; h [B,L,d]; key_mask [B,1,1,L] bool (True = attend) or None
        B, Q, d = x.shape
        L = h.shape[1]
        hn = self.nkv(h)
        q = self.q(self.nq(x)).view(B, Q, self.nhead, self.hd).transpose(1, 2)
        k = self.k(hn).view(B, L, self.nhead, self.hd).transpose(1, 2)
        v = self.v(hn).view(B, L, self.nhead, self.hd).transpose(1, 2)
        a = F.scaled_dot_product_attention(q, k, v, attn_mask=key_mask)
        a = a.transpose(1, 2).reshape(B, Q, d)
        x = x + self.drop(self.o(a))
        return x + self.drop(self.ff(self.nf(x)))


class SharedModel(nn.Module):
    def __init__(self, encoder: nn.Module, n_questions: int, head_layers: int = 2, dropout: float = 0.1):
        super().__init__()
        self.encoder = encoder
        d = encoder.config.hidden_size
        self.n_questions = n_questions
        self.queries = nn.Parameter(torch.randn(n_questions, d) * 0.02)
        self.layers = nn.ModuleList([CrossLayer(d, max(1, d // 64), dropout) for _ in range(head_layers)])
        self.trunk = nn.Sequential(nn.LayerNorm(d), nn.Linear(d, d), nn.GELU())
        self.out_w = nn.Parameter(torch.randn(n_questions, d, KMAX) * (1.0 / math.sqrt(d)))
        self.out_b = nn.Parameter(torch.zeros(n_questions, KMAX))
        self.head_checkpointing = False

    def head_parameters(self):
        return [p for n, p in self.named_parameters() if not n.startswith("encoder.")]

    def forward(self, input_ids, attention_mask=None):
        """Returns raw logits [B, Q, KMAX]; columns beyond a question's width are meaningless (mask them)."""
        h = self.encoder(input_ids=input_ids, attention_mask=attention_mask).last_hidden_state
        key_mask = None if attention_mask is None else attention_mask.bool()[:, None, None, :]
        x = self.queries.unsqueeze(0).expand(h.size(0), -1, -1)
        for layer in self.layers:
            x = layer(x, h, key_mask)
        x = self.trunk(x)
        return torch.einsum("bqd,qdk->bqk", x, self.out_w.to(x.dtype)) + self.out_b.to(x.dtype)


def load_base(model_dir: str | Path, n_questions: int, head_layers: int = 2, device="cpu"):
    """Build SharedModel with the Laya base encoder tensors; heads freshly initialised (seed set by caller)."""
    from safetensors.torch import load_file
    from laya.common import build_model

    model_dir = Path(model_dir)
    cfg = json.load(open(model_dir / "rl_agent_config.json"))
    full = build_model(cfg, encoder_dir=str(model_dir / "encoder"))
    full.load_state_dict(load_file(str(model_dir / "model.safetensors")), strict=True)
    enc = full.encoder
    if hasattr(enc.config, "reference_compile"):
        enc.config.reference_compile = False
    return SharedModel(enc, n_questions, head_layers=head_layers), cfg


def build_for_inference(ckpt_dir: str | Path, device="cpu"):
    """Rebuild a saved checkpoint (model.safetensors fp16 + encoder/ config + shared_config.json)."""
    from safetensors.torch import load_file
    from transformers import AutoConfig, AutoModel
    from laya.common import _apply_rope_config

    ckpt_dir = Path(ckpt_dir)
    sc = json.load(open(ckpt_dir / "shared_config.json"))
    ecfg = AutoConfig.from_pretrained(str(ckpt_dir / "encoder"))
    _apply_rope_config(ecfg)
    enc = AutoModel.from_config(ecfg, attn_implementation="sdpa")
    m = SharedModel(enc, sc["n_questions"], head_layers=sc["head_layers"])
    sd = {k: v.float() for k, v in load_file(str(ckpt_dir / "model.safetensors")).items()}
    m.load_state_dict(sd, strict=True)
    if hasattr(enc.config, "reference_compile"):
        enc.config.reference_compile = False
    return m.to(device).eval(), sc
