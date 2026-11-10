#!/usr/bin/env python3
"""Head-extension generation driver (sizing addendum signed t217u, section 12 item 1).

Builds jobs from the pinned slot spec (cells = register x length, round-robin; per-job seed = sha256), renders the
pinned system prompt + user template, calls ONE self-hosted vLLM server (OpenAI-compatible) and writes rows.
Refuses: OpenAI models, any non-local base URL, a spec / prompt whose sha differs from the pin, and labeling by
the generator family (same-family rule). Never prints row text.

  python3 headext_slots.py generate --base-url http://127.0.0.1:18000 --served qwen3 --out gen.jsonl \
      --host runpod:<pod>/<gpu>/vllm-<v> --expect-spec-sha <sha> [--concurrency 64 --max-wall-seconds 1500]
  python3 headext_slots.py items --gen gen.jsonl --out items.jsonl     # labeler input (id, content, writer_family)
  python3 headext_slots.py plan --expect-spec-sha <sha>                # counts only
"""
from __future__ import annotations

import argparse, hashlib, json, re, sys, time, urllib.parse, urllib.request
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
SPEC = HERE / "headext-slot-spec.json"
GEN_FAMILY = "qwen"
WRITER_FAMILIES = {"qwen", "mistral"}  # t220u A21: Mistral-Small-3.2 writes the G3 rows
OPENAI_MARKERS = ("openai", "gpt-")
LOCAL_HOSTS = {"127.0.0.1", "localhost", "::1"}


class Blocked(RuntimeError):
    pass


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def sha256_file(p) -> str:
    return sha256_bytes(Path(p).read_bytes())


def load_pinned(spec_path=SPEC, expect_spec_sha: str | None = None):
    raw = Path(spec_path).read_bytes()
    got = sha256_bytes(raw)
    if expect_spec_sha is None or got != expect_spec_sha:
        raise Blocked(f"slot spec sha {got} != pinned {expect_spec_sha}")
    spec = json.loads(raw.decode("utf-8"))
    pp = Path(spec_path).parent / spec["system_prompt_file"]
    if sha256_file(pp) != spec["system_prompt_sha256"]:
        raise Blocked("system prompt sha differs from the slot spec")
    g = spec["generator"]
    if any(m in (g["key"] + g["hf_id"]).lower() for m in OPENAI_MARKERS):
        raise Blocked("OpenAI models are forbidden")
    if [r["id"] for r in spec["registers"]] != ["clinical", "colloquial", "terse"]:
        raise Blocked("register order differs from the signed order clinical, colloquial, terse")
    return spec, pp.read_text(encoding="utf-8")


def check_labeler_family(labeler_family: str):
    """Same-family rule: the generator family never labels or checks its own rows."""
    if labeler_family in WRITER_FAMILIES:
        raise Blocked(f"labeler family {labeler_family} is a generator family")


def kind_seed(salt: str, kind: str, i: int) -> int:
    return int(sha256_bytes(f"{salt}|{kind}|{i}".encode())[:8], 16)


def cells_for(spec: dict, kind: dict) -> list[tuple[str, str]]:
    ok = kind.get("lengths")  # t232u (F4): a kind may restrict its length band (e.g. short only)
    return [(r, l["id"]) for r in kind["registers"] for l in spec["lengths"] if not ok or l["id"] in ok]


def assignment(spec: dict, kind: dict, i: int, phase: str = "g1") -> dict:
    ex = kind.get("extra")
    a = {}
    if phase == "g3" and kind.get("g3_extra") == "topic":
        return {"topic": spec["sec_topics"][i % len(spec["sec_topics"])]}
    if ex in ("brand", "brand_promo"):
        a["brand"] = spec["brands"][i % len(spec["brands"])]
        a["product"] = spec["products"][(i // len(spec["brands"])) % len(spec["products"])]
        if ex == "brand_promo":
            a["promo_code"] = spec["promo_codes"][i % len(spec["promo_codes"])]
    elif ex in ("service_call", "service_text"):
        keys = spec["call_services"] if ex == "service_call" else spec["text_services"]
        a["service"] = keys[i % len(keys)]
    return a


def job_indices(k: dict, phase: str) -> range:
    """G1: 0..quota-1 (the pinned G1 jobs, unchanged). G2 (amendment t218u): g2_start..g2_start+g2_quota-1 for re-specified
    (A14) and top-up (A16) kinds only; ids never collide with G1 ids."""
    if phase == "g1":
        return range(k["quota"])
    if phase == "g2":
        return range(k["g2_start"], k["g2_start"] + k["g2_quota"]) if k.get("g2_quota") else range(0)
    if phase == "g3":  # amendment t220u (A21/A24)
        return range(k["g3_start"], k["g3_start"] + k["g3_quota"]) if k.get("g3_quota") else range(0)
    if phase == "g4":  # t227u (A31): offer top-up under the tightened g4_shape
        return range(k["g4_start"], k["g4_start"] + k["g4_quota"]) if k.get("g4_quota") else range(0)
    if phase == "g5":  # t232u rerun (F3/F4): new kinds only
        return range(k["g5_start"], k["g5_start"] + k["g5_quota"]) if k.get("g5_quota") else range(0)
    if phase == "g6":  # t237u F6: built by build_g6_jobs, not this range
        return range(0)
    raise Blocked(f"unknown phase {phase}")


REARM_CANDIDATES = 2


def rearm_jobs(spec: dict, arm_a_rows: list[dict]) -> list[dict]:
    """t232u (F1): regenerate only the B arm of an off-spec pair, given its A text. Two candidates per unit; the
    pair_unit (and so the val/train side) is unchanged."""
    jobs = []
    for r in arm_a_rows:
        k = next(x for x in spec["kinds"] if x["id"] == r["kind_spec"])
        if not (k.get("pair") and k.get("g5_b_shape")):
            raise Blocked(f"kind {k['id']} has no g5_b_shape for re-arm")
        for c in range(REARM_CANDIDATES):
            jobs.append({"id": f"{r['pair_unit']}-r{c}", "kind": k["id"], "head": k["head"], "role": k["role"], "pair": False,
                         "rearm": True, "pair_unit": r["pair_unit"], "candidate": c, "arm_a_text": r["content"],
                         "sample": r["sample"], "register": r["register"], "length": r["length"], "cell": f"{r['register']}/{r['length']}",
                         "seed": kind_seed(spec["split_salt"], k["id"] + "|rearm", r["sample"] * REARM_CANDIDATES + c),
                         "assign": r.get("assign") or {}, "writer": spec["generator"]["key"], "phase": "g5"})
    return jobs


def build_g6_jobs(spec: dict) -> list[dict]:
    """t237u F6: 36 training pairs (plus 1.3x surplus) target the missed short/bare first-person shape; 12 new
    val pairs (plus surplus) use the declared register x length mix, with that shape on the short cells only
    (in proportion, not hand-selected)."""
    k = next(x for x in spec["kinds"] if x["id"] == "op-own-vs-reported")
    jobs = []
    writer = writer_key(spec, k, "g6")
    train_cells = [(r, "short") for r in k["registers"]]
    for i in range(k["g6_train_start"], k["g6_train_start"] + k["g6_train_quota"]):
        reg, ln = train_cells[i % len(train_cells)]
        jobs.append({"id": f"hx-{k['id']}-{i:03d}", "kind": k["id"], "head": k["head"], "role": k["role"],
                     "pair": True, "sample": i, "register": reg, "length": ln, "cell": f"{reg}/{ln}",
                     "seed": kind_seed(spec["split_salt"], k["id"], i),
                     "assign": {"sentiment": ["favourable", "unfavourable"][i % 2]},
                     "writer": writer, "phase": "g6", "f6": True, "pool": "train"})
    val_cells = cells_for(spec, k)
    for i in range(k["g6_val_start"], k["g6_val_start"] + k["g6_val_quota"]):
        reg, ln = val_cells[i % len(val_cells)]
        f6 = ln == "short"
        assign = {"sentiment": ["favourable", "unfavourable"][i % 2]} if f6 else {}
        jobs.append({"id": f"hx-{k['id']}-{i:03d}", "kind": k["id"], "head": k["head"], "role": k["role"],
                     "pair": True, "sample": i, "register": reg, "length": ln, "cell": f"{reg}/{ln}",
                     "seed": kind_seed(spec["split_salt"], k["id"], i), "assign": assign,
                     "writer": writer, "phase": "g6", "f6": f6, "pool": "val"})
    ids = [j["id"] for j in jobs]
    assert len(ids) == len(set(ids))
    return jobs


def build_jobs(spec: dict, phase: str = "g1", arm_a_rows: list[dict] | None = None) -> list[dict]:
    if phase == "g6":
        return build_g6_jobs(spec)
    jobs = rearm_jobs(spec, arm_a_rows) if (phase == "g5" and arm_a_rows) else []
    for k in spec["kinds"]:
        cells = cells_for(spec, k)
        for i in job_indices(k, phase):
            reg, ln = cells[i % len(cells)]
            jobs.append({"id": f"hx-{k['id']}-{i:03d}", "kind": k["id"], "head": k["head"], "role": k["role"],
                         "pair": bool(k.get("pair")), "sample": i, "register": reg, "length": ln, "cell": f"{reg}/{ln}",
                         "seed": kind_seed(spec["split_salt"], k["id"], i), "assign": assignment(spec, k, i, phase),
                         "writer": writer_key(spec, k, phase)})
            if phase == "g4" and k.get("g4_shape"):
                jobs[-1].update({"phase": "g4", "shape": k["g4_shape"]})
            if phase == "g5":
                jobs[-1]["phase"] = "g5"
    ids = [j["id"] for j in jobs]
    assert len(ids) == len(set(ids))
    return jobs


def writer_key(spec: dict, kind: dict, phase: str) -> str:
    if phase in ("g3", "g4") and kind.get(f"{phase}_writer"):
        return kind[f"{phase}_writer"]
    return spec["generator"]["key"]


def writer_pins(spec: dict, key: str) -> dict:
    if key == spec["generator"]["key"]:
        return spec["generator"]
    w = (spec.get("writers") or {}).get(key)
    if not w:
        raise Blocked(f"writer {key} is not pinned in the slot spec")
    return w


def _extra_text(spec: dict, job: dict) -> str:
    a = job["assign"]
    if "topic" in a:
        return f"\nThe user's problem: {a['topic']}."
    if "brand" in a:
        s = f"\nInvented product: {a['brand']}, {a['product']}. Use the name {a['brand']} exactly."
        if "promo_code" in a:
            s += f" Promo code: {a['promo_code']}."
        return s
    if "service" in a:
        sv = next(x for x in spec["crisis_services"] if x["key"] == a["service"])
        return f"\nCrisis service to name: {sv['name']} ({sv['jurisdiction']}); contact: {sv['contact']}. Copy the contact exactly."
    if "sentiment" in a:
        return f"\nSentiment of the view: {a['sentiment']}."
    return ""


def render_user(spec: dict, job: dict) -> str:
    k = next(x for x in spec["kinds"] if x["id"] == job["kind"])
    reg = next(r["instruction"] for r in spec["registers"] if r["id"] == job["register"])
    ln = next(l["instruction"] for l in spec["lengths"] if l["id"] == job["length"])
    if job.get("rearm"):
        return spec["rearm_template"].format(deciding=k["deciding"], arm_a_text=job["arm_a_text"], arm_b=k["g5_b_shape"],
                                             register=reg, length=ln, extra=_extra_text(spec, job))
    if k.get("pair"):
        arms = (k.get("g6_arms") if job.get("f6") else None) or k["arms"]
        return spec["pair_template"].format(deciding=k["deciding"], arm_a=arms[0]["shape"], arm_b=arms[1]["shape"],
                                            register=reg, length=ln, extra=_extra_text(spec, job))
    return spec["user_template"].format(shape=job.get("shape") or k["shape"], register=reg, length=ln, extra=_extra_text(spec, job))


def request_body(spec: dict, system_prompt: str, job: dict, served: str) -> dict:
    s = spec["sampling"]
    body = {"model": served, "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": render_user(spec, job)}],
            "temperature": s["temperature"], "max_tokens": s["max_tokens_pair"] if job["pair"] else s["max_tokens"], "seed": job["seed"]}
    w = writer_pins(spec, job.get("writer") or spec["generator"]["key"])
    if w.get("chat_template_kwargs"):
        body["chat_template_kwargs"] = w["chat_template_kwargs"]
    return body


def check_base_url(base_url: str):
    host = urllib.parse.urlparse(base_url).hostname or ""
    if host not in LOCAL_HOSTS or "openai" in base_url or "openrouter" in base_url:
        raise Blocked(f"generation must use a self-hosted server reached on localhost, not {base_url}")


def _post(base_url: str, body: dict, timeout: float = 600) -> dict:
    check_base_url(base_url)
    req = urllib.request.Request(base_url.rstrip("/") + "/v1/chat/completions", data=json.dumps(body).encode("utf-8"),
                                 headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


THINK_RE = re.compile(r"<think>.*?</think>", re.S)


def strip_reasoning(text: str):
    n = len(THINK_RE.findall(text))
    return THINK_RE.sub("", text), n


def parse_pair(text: str):
    """Returns (A, B) or None. Accepts a JSON object possibly wrapped in a code fence."""
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r"^```[a-zA-Z]*\s*", "", t); t = re.sub(r"\s*```$", "", t)
    i, j = t.find("{"), t.rfind("}")
    if i < 0 or j <= i:
        return None
    try:
        o = json.loads(t[i:j + 1])
    except json.JSONDecodeError:
        return None
    a, b = (o.get("A"), o.get("B")) if isinstance(o, dict) else (None, None)
    if not (isinstance(a, str) and isinstance(b, str) and a.strip() and b.strip()):
        return None
    return a.strip(), b.strip()


def make_rows(spec: dict, job: dict, raw: dict, host: str, ts: str, spec_sha: str) -> list[dict]:
    ch = (raw.get("choices") or [{}])[0]
    text = (ch.get("message") or {}).get("content") or ""
    clean, markers = strip_reasoning(text)
    clean = clean.strip()
    k = next(x for x in spec["kinds"] if x["id"] == job["kind"])
    ln = next(x for x in spec["lengths"] if x["id"] == job["length"])
    g = writer_pins(spec, job.get("writer") or spec["generator"]["key"])
    base = {"family": "headext-" + job["head"], "kind_spec": k["id"], "head": job["head"], "role": job["role"],
            "register": job["register"], "length": job["length"], "cell": job["cell"], "sample": job["sample"],
            "seed": job["seed"], "assign": job["assign"], "model_key": g["key"], "hf_id": g["hf_id"], "revision": g["revision"],
            "writer_family": g["family"],
            "slot_spec_sha256": spec_sha, "system_prompt_sha256": spec["system_prompt_sha256"],
            "temperature": spec["sampling"]["temperature"], "finish_reason": ch.get("finish_reason"), "reasoning_markers": markers,
            "host": host, "timestamp": ts}
    if job.get("phase") in ("g4", "g5", "g6"):
        base["phase"] = job["phase"]
    if job.get("rearm"):
        arm = k["arms"][1]; nw = len(clean.split())
        return [{"id": f"{job['pair_unit']}-b-r{job['candidate']}", "content": clean, "kind": arm.get("kind") or f"{k['id']}-b",
                 "contrastGroup": k["id"], "arm": "B", "pair_unit": job["pair_unit"], "rearm_candidate": job["candidate"],
                 "provenance": {**base, "rearm_of": f"{job['pair_unit']}-b", "n_words": nw,
                                "length_in_band": ln["min_words"] <= nw <= ln["max_words"], "empty": not clean}}]
    if k.get("pair"):
        pr = parse_pair(clean)
        out = []
        for idx, arm in enumerate(k["arms"]):
            content = pr[idx] if pr else ""
            nw = len(content.split())
            out.append({"id": f"{job['id']}-{arm['arm'].lower()}", "content": content,
                        "kind": arm.get("kind") or f"{k['id']}-{arm['arm'].lower()}", "contrastGroup": k["id"], "arm": arm["arm"],
                        "pair_unit": job["id"], "provenance": {**base, "pair_parse_ok": pr is not None, "n_words": nw,
                        "length_in_band": ln["min_words"] <= nw <= ln["max_words"], "empty": not content}})
        return out
    nw = len(clean.split())
    return [{"id": job["id"], "content": clean, "kind": k["id"], "provenance": {**base, "n_words": nw,
             "length_in_band": ln["min_words"] <= nw <= ln["max_words"], "empty": not clean}}]


def generate(base_url: str, served: str, out: str, host: str, expect_spec_sha: str, concurrency: int = 64,
             wall: float = 1500, spec_path=SPEC, post=_post, phase: str = "g1", arm_a_file: str | None = None) -> dict:
    from concurrent.futures import ThreadPoolExecutor, as_completed
    check_base_url(base_url)
    spec, sysp = load_pinned(spec_path, expect_spec_sha)
    arm_a = [json.loads(l) for l in open(arm_a_file, encoding="utf-8") if l.strip()] if arm_a_file else None
    jobs = build_jobs(spec, phase, arm_a)
    if any(any(m in (served + writer_pins(spec, j["writer"])["hf_id"]).lower() for m in OPENAI_MARKERS) for j in jobs):
        raise Blocked("OpenAI models are forbidden")
    if {j["writer"] for j in jobs} != {served}:
        raise Blocked(f"served model {served} is not the pinned writer of every {phase} job ({sorted({j['writer'] for j in jobs})})")
    done = set()
    if Path(out).is_file():
        for l in open(out, encoding="utf-8"):
            if l.strip():
                r = json.loads(l)
                done.add(f"{r['pair_unit']}-r{r['rearm_candidate']}" if "rearm_candidate" in r else (r.get("pair_unit") or r["id"]))
    todo = [j for j in jobs if j["id"] not in done]
    st = {"phase": phase, "n_jobs": len(jobs), "n_resumed": len(jobs) - len(todo), "n_jobs_written": 0, "n_rows_written": 0, "n_errors": 0,
          "errors": [], "stop_reason": "complete"}
    t0 = time.time()

    def one(j):
        last = None
        for attempt in range(3):
            try:
                raw = post(base_url, request_body(spec, sysp, j, served))
                return make_rows(spec, j, raw, host, datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), expect_spec_sha), None
            except Blocked:
                raise
            except Exception as e:  # noqa: BLE001
                last = f"{type(e).__name__}: {str(e)[:160]}"
                time.sleep(1 + attempt)
        return None, last

    Path(out).parent.mkdir(parents=True, exist_ok=True)
    with open(out, "a", encoding="utf-8") as fh, ThreadPoolExecutor(concurrency) as ex:
        futs = {ex.submit(one, j): j for j in todo}
        for f in as_completed(futs):
            rows, err = f.result()
            if rows is not None:
                for r in rows:
                    fh.write(json.dumps(r, ensure_ascii=False) + "\n")
                fh.flush(); st["n_jobs_written"] += 1; st["n_rows_written"] += len(rows)
            else:
                st["n_errors"] += 1; st["errors"].append({"id": futs[f]["id"], "error": err})
            if time.time() - t0 > wall:
                st["stop_reason"] = "wall_clock_limit"
                for g in futs:
                    g.cancel()
                break
    st["elapsed_seconds"] = round(time.time() - t0, 1)
    st["out_sha256"] = sha256_file(out)
    return st


def items(gen_path: str, out: str) -> dict:
    rows = [json.loads(l) for l in open(gen_path, encoding="utf-8") if l.strip()]
    its = [{"id": r["id"], "content": r["content"], "writer_family": r.get("provenance", {}).get("writer_family", GEN_FAMILY)}
           for r in rows if r["content"]]
    ids = [i["id"] for i in its]
    if len(ids) != len(set(ids)):
        raise Blocked("duplicate item ids")
    Path(out).write_text("".join(json.dumps(i, ensure_ascii=False) + "\n" for i in its), encoding="utf-8")
    return {"n_rows": len(rows), "n_empty": len(rows) - len(its), "n_items": len(its), "items_sha256": sha256_file(out)}


def plan(spec: dict, phase: str = "g1") -> dict:
    jobs = build_jobs(spec, phase)
    return {"phase": phase, "n_jobs": len(jobs), "n_candidate_rows": sum(2 if j["pair"] else 1 for j in jobs),
            "per_head_jobs": {h: sum(1 for j in jobs if j["head"] == h) for h in spec["heads"] + ["self_harm"]}}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd", required=True)
    g = sp.add_parser("generate")
    for a in ("--base-url", "--served", "--out", "--host", "--expect-spec-sha"):
        g.add_argument(a, required=True)
    g.add_argument("--concurrency", type=int, default=64); g.add_argument("--max-wall-seconds", type=float, default=1500)
    g.add_argument("--arm-a-file")
    g.add_argument("--phase", choices=["g1", "g2", "g3", "g4", "g5", "g6"], default="g1")
    it = sp.add_parser("items"); it.add_argument("--gen", required=True); it.add_argument("--out", required=True)
    pl = sp.add_parser("plan"); pl.add_argument("--expect-spec-sha", required=True); pl.add_argument("--phase", choices=["g1", "g2", "g3", "g4", "g5", "g6"], default="g1")
    a = ap.parse_args(argv)
    if a.cmd == "generate":
        st = generate(a.base_url, a.served, a.out, a.host, a.expect_spec_sha, a.concurrency, a.max_wall_seconds, phase=a.phase, arm_a_file=a.arm_a_file)
        print(json.dumps({k: v for k, v in st.items() if k != "errors"} | {"error_ids": [e["id"] for e in st["errors"]][:50]}))
        return 0 if st["stop_reason"] == "complete" and not st["n_errors"] else 3
    if a.cmd == "items":
        print(json.dumps(items(a.gen, a.out))); return 0
    spec, _ = load_pinned(SPEC, a.expect_spec_sha)
    print(json.dumps(plan(spec, a.phase))); return 0


if __name__ == "__main__":
    sys.exit(main())
