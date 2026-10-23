"""Step 3 shared helpers: encode one response exactly as laya 0.3.21 Agent.predict does
(Agent._encode_state -> laya.common.build_sequence per question -> collate_items), and decode raw
logits into the T=1 probabilities the task1 gate consumes (analyze_laya_task1.py softmax at T=1).

Laya's input format (laya/common.py build_sequence docstring, line 146):
    [CLS] <type> question: instructions [SEP] [MASK] opt0 [MASK] opt1 ... [SEP] state [SEP]
so every question is its own encoder sequence; one response = 17 question-conditioned sequences.
"""
import hashlib, json, os
import numpy as np

SUITE_SHA = "6c7b30e16b8ab53544f590bcbbdcd381f32e3e4cf324e225e2e8c489cebb28e4"
QUESTIONS_FILE_SHA = "f519fa8e4763cc95acef3d134f984941c263043bad4abfd2a827c69e560650ee"
MAX_LEN, HEAD_MAX_LEN = 1024, 256  # same as task1 bench_latency*.py / infer_raw.py / gate_laya.py


def sha256_file(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 22), b""):
            h.update(b)
    return h.hexdigest()


def load_inputs(suite_path, questions_path):
    for p, want in ((suite_path, SUITE_SHA), (questions_path, QUESTIONS_FILE_SHA)):
        got = sha256_file(p)
        if got != want:
            raise SystemExit(f"SHA mismatch {p}: {got} != {want}")
    items = json.load(open(suite_path))["items"]
    qs = json.load(open(questions_path))
    assert len(items) == 471 and len(qs) == 17, (len(items), len(qs))
    return items, qs


class Encoder:
    """Tokenizer + laya's own sequence builder; no model."""

    def __init__(self, ckpt_dir, questions):
        from transformers import AutoTokenizer
        from laya.agent import Agent
        tcfg = json.load(open(os.path.join(ckpt_dir, "tokenizer", "tokenizer_config.json")))
        # Agent._fix_tokenizer_config would rewrite the checkpoint only for these cases; refuse instead.
        assert tcfg.get("tokenizer_class") not in (None, "TokenizersBackend"), tcfg.get("tokenizer_class")
        self.tok = AutoTokenizer.from_pretrained(os.path.join(ckpt_dir, "tokenizer"))
        self.ids = list(questions.keys())
        for q in self.ids:
            Agent._check_question(q, questions[q])
        self.internal = {q: Agent._to_internal(questions[q]) for q in self.ids}

    def state_ids(self, state):
        from laya.common import encode_text, serialize_state
        return encode_text(self.tok, serialize_state(state).replace(self.tok.mask_token, " "),
                           add_special_tokens=False)["input_ids"]

    def encode(self, state, max_len=MAX_LEN, head_max_len=HEAD_MAX_LEN):
        """== Agent._encode_state (agent.py 752-783): tokenize state once, one sequence per question."""
        from laya.common import QTYPES, build_sequence, render_options
        sids = self.state_ids(state)
        items = []
        for qid in self.ids:
            q = self.internal[qid]
            seq, markers, stats = build_sequence(self.tok, state, q, max_len, head_max_len,
                                                 truncate_left=isinstance(state, list), state_ids=sids,
                                                 return_stats=True)
            assert len(markers) == len(render_options(q))
            items.append({"ids": seq, "markers": markers, "qtype": QTYPES[q["t"]], "options": stats})
        return items, len(sids)

    def collate(self, items):
        """== laya.common.collate_items (pads every row to the longest), as numpy for ORT."""
        n, L = len(items), max(len(it["ids"]) for it in items)
        k = max(len(it["markers"]) for it in items)
        ids = np.full((n, L), self.tok.pad_token_id, dtype=np.int64)
        att = np.zeros((n, L), dtype=np.int64)
        mpos = np.zeros((n, k), dtype=np.int64)
        mmask = np.zeros((n, k), dtype=bool)
        for i, it in enumerate(items):
            ids[i, :len(it["ids"])] = it["ids"]; att[i, :len(it["ids"])] = 1
            mpos[i, :len(it["markers"])] = it["markers"]; mmask[i, :len(it["markers"])] = True
        qt = np.array([it["qtype"] for it in items], dtype=np.int64)
        return {"input_ids": ids, "attention_mask": att, "marker_pos": mpos, "marker_mask": mmask, "qtype": qt}


def softmax(z):
    z = np.asarray(z, dtype=np.float64); e = np.exp(z - z.max()); return e / e.sum()


def decode(ids, items, logits_rows):
    """Raw logits (one row per question) -> {"logits", "stance_probs", "p_true"} at T=1, as
    analyze_laya_task1.py writes heldout-probs-*.jsonl (the gate's input)."""
    lg = {q: [float(x) for x in logits_rows[j][:len(items[j]["markers"])]] for j, q in enumerate(ids)}
    stance_keys = ["conveys_method", "depicts", "describes", "encourages", "endorses"]
    sp = softmax(lg["stance"])
    return {"logits": lg,
            "stance_probs": {k: float(v) for k, v in zip(stance_keys, sp)},
            "p_true": {q: float(softmax(lg[q])[1]) for q in ids if q != "stance"}}
