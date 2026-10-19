# v3: independent held-out suite and corpus work

This is the starting point for the v3 held-out suite and the collected-outputs corpus (Justin, 2026-10-19:
everything in AIRP is open). It contains **no copy of the v2 suite or the v1-207 items**.
`tools/check_no_protected.py` enforces that (see docs/LEAK-CHECK.md).

No items have been collected yet. Nothing here calls a model or spends money.

## Contents

| path | what |
|---|---|
| `PRIMITIVES.md` | the 17 heads (1 stance with 5 values, 7 objects, 9 qualifiers) with verbatim definitions. Byte-identical copy of `decide/shared-adopt/PRIMITIVES.md` (commit 3266147) |
| `CLASSES.md`, `spec/classes.json` | the 11 AIRP v0.5.0 classes: verbatim title/definition/severity from `data/taxonomy/flags.v0.json`, plus the composition-2a rule for each |
| `spec/primitives.json` | the head names and verbatim definitions from `vocabulary.json` (without its `examples`, which overlap v2) |
| `spec/composition-2a.json` | composition 2a, byte-identical (sha256 `59ddf1f6…`) |
| `airp_v3/compose.py`, `node/compose.mjs` | composition as a callable: library + CLI, Python and Node |
| `airp_v3/score.py` | scoring: gold as `expect_primitives` → derived `expect_classes` → E, M, E+M, macro-F1, per-class, per-primitive, safety, and N/N rate |
| `airp_v3/leakcheck.py` | blind leak check: file hash in, colliding ids out |
| `tools/check_no_protected.py` | CI-free no-v2/v1-207 check (hash fingerprints) |
| `docs/RED-TEAM-PROMPT-SETS.md` | shortlist of public prompt sets: licence, size, CSE separability |
| `docs/OPENROUTER-MODELS.md` | non-OpenAI model shortlist: terms, prices (2026-10-19), test/train split, and the OpenRouter red-teaming approval needed first |
| `docs/LOCATION.md` | why a separate public repo is recommended, and the sparse-checkout fallback |

## Quick start (Python 3.10+, no dependencies)

    cd v3
    python3 -m airp_v3.compose --stance encourages --objects sexual_activity --qualifiers subject_is_minor
    # ["child_sexual_exploitation"]
    node node/compose.mjs --stance depicts --objects violence_person          # ["violence"]
    python3 -m airp_v3.score --items my-items.jsonl --pred model-a.jsonl --pred model-b.jsonl
    python3 tools/check_no_protected.py
    python3 -m unittest discover -s tests -t .

Item format (one JSON object per line). Ids must be new: never reuse a v2 id.

    {"id": "v3-sh-0001", "content": "...", "expect_primitives": {"stance": "encourages", "objects": ["self_harm"], "qualifiers": []}}

`expect_classes` is **derived**, never hand-written. If you include one, the scorer reports any row where
it disagrees with the derivation.

## Rules for v3 authors

- Don't open `data/evaluator-gate/held-out-suite.v*.json` or any v2/v1-207 text. Use a sparse checkout
  (docs/LOCATION.md).
- Don't write or request child-sexual-exploitation content. CSE categories are filtered out of every
  prompt set before any run (docs/RED-TEAM-PROMPT-SETS.md).
- No OpenAI models or products anywhere.
- Run `tools/check_no_protected.py` before every commit, and get a blind leak check on every item file.
