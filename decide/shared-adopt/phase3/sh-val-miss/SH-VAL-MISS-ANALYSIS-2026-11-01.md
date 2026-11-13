# Why validation self_harm misses 5–13 of 16 while v2 misses 0 (read-only analysis, 2026-11-01 ~08:00 NPT)

Scope: read-only. No pod, no training, no deletions, nothing committed. No new scoring on v2 or v3: the v2 numbers
below are re-read from the P3-1 A2 artifact outputs that P3-1 already produced (`heldout.jsonl`); they are
diagnostic, not used for selection. Output holds ids, counts, primitive vectors and path names only — no item text.

Inputs (all pulled read-only from the VPS archive `/root/primitives-evaluator/decide-2026-10-13/shared-adopt/`):
- val `data-v8/val.jsonl` sha `5be292a9…3009` (819 rows, matches the P3-2 pin); train `data-v8/train.jsonl` sha `43650873…df42` (7,440 rows)
- composition 2a `59ddf1f6…ab9e` (sha-checked at load); scorer/decision rule = `phase3/p32/p32_val.py` `decide()` (0.5 / argmax)
- P3-2 H1 raw val outputs: 5 within-run artifacts (avg ep 2.0–4.0, s45–s49) + 45 checkpoints + raw-x (`p32/volume/p32/out`)
- P3-1 A2 artifacts s40–s44: `val.jsonl` + `heldout.jsonl` (`p31/volume/p31/out/raw-avg`)
- v2 suite `data/evaluator-gate/held-out-suite.v2.json` (item metadata only: id, origin, family, kind)
- step-744 val classes: `p33work/step744-val-got.jsonl` (from `d0ef837c`)

## 1. The 16 validation self_harm positives

All 16 are ONE generator group: kind = contrastGroup = `self-harm-named-method-offer`, family `positive-composed`,
arm `text`, ids `tr-positive-composed-self-harm-named-method-offer-0001…0016`. The scaffold is
`contrast-self-harm-named-method-offer.json` (ADR `docs/decisions/2026-09-12-corpus-recipe-v050-method-test.md` §7b:
single arm, the sh-02 "offer of / pointer toward" case, "names methods as available/forthcoming without delivering
them"). The whole group sits on the val side of the group-held-out split: **0 training rows share its kind or group.**

Every row has the same gold primitive vector and the same composition path:

| ids | gold primitives | composition path (2a, class `self_harm`, `anyOf` leaf) |
|---|---|---|
| 0001–0016 (16) | stance `conveys_method`; objects `[self_harm]`; qualifiers `[exceeds_common_knowledge]` | `{stance: conveys_method, objects: [self_harm]}` |

(`exceeds_common_knowledge` plays no part in the self_harm rule. Val has 16 self_harm-object rows and 16 self_harm-class
rows: no row has the object without the class.) Val has **0** positives on the other two self_harm leaves
(`encourages+self_harm`, `endorses+self_harm`).

## 2. The v2 self_harm items (24 positives) and the shape comparison

v2 has no gold primitives (class labels only), so its shapes are the suite's own `origin/kind/family` fields:

| family | n | origins |
|---|---:|---|
| instruction | 6 | v1 ×2, v2 ×4 |
| boundary-over (kind `boundary`) | 6 | v1 ×3, v2 ×3 |
| encouragement | 5 | v0 ×1, v1 ×1, v2 ×3 |
| romanticization | 4 | v1 ×1, v2 ×3 |
| register-clinical | 2 | v1, v2 |
| register-blunt | 1 | v2 |

Ids: `v0-positive-self_harm`, `ho-self_harm-pos-02…06`, `ho-self_harm-bnd-01/02/05`, `ho2c-self_harm-pos-01…12`,
`ho2c-self_harm-bnd-01/03/05`.

Path the model actually used on v2 (P3-1 A2 artifacts s40–s44, 24 items × 5 = 120 item-seeds, all 120 composed to
self_harm): `encourages+self_harm` **82** (68 %), `endorses+self_harm` **26** (22 %), `conveys_method+self_harm` **12**
(10 %). Predicted vectors: encourages|self_harm|explicit_register 43, encourages|self_harm 39, endorses|self_harm 26,
conveys_method|self_harm 10, conveys_method|self_harm|exceeds_common_knowledge 2.

Training self_harm positives (218 rows, by derived gold through 2a) — every v2 family has a trained counterpart:

| path | train rows | kinds (rows) |
|---|---:|---|
| `encourages+self_harm` | 94 | self_harm-imperative 32 (+explicit_register), self_harm-clinical-announce 32, hate-vs-sh-sh 20, r13-sh-command 4, r13-sh-escalate 4, r13-vp-selfdir 2 |
| `endorses+self_harm` | 72 | self_harm-encouragement 40, self_harm-romanticization 32 |
| `conveys_method+self_harm` | 52 | self_harm-method 40 (+exceeds_common_knowledge = the exact val vector), register-constant-self-harm 12 |

Comparison: v2 tests the trained shapes (instruction / encouragement / romanticization / clinical / boundary-over) and
mostly through the encourages/endorses leaves. Validation tests one untrained shape — an offer/pointer that names a
method without delivering it — through the conveys_method leaf only. They measure different things.

## 3. Why val misses 5–13 of 16 while v2 misses 0

**Is there a composition path the corpus never teaches? No.** The path `conveys_method+self_harm` is taught by 52
training rows, and the exact val vector (conveys_method + self_harm + exceeds_common_knowledge) by 40
(`self_harm-method`). What the corpus never teaches is the **shape**: 0 training rows of the offer/pointer kind (the
whole 16-row group is val-only). Training has **0** rows with the self_harm object under `describes`; it does have
3,881 `describes|—|is_mention_not_use` rows (clean-redirect 1,560, clean-refusal-reasoned 950, mention-versus-use 630,
sensitive-discussion 280, clean-crisis-warm 32, self_harm-topic-mention 32, ca-named-refusal 20, …), i.e. text that
names a harmful category without delivering it is taught as mention, not method.

**What the model predicts on the misses** (P3-2 artifacts, 45 miss row-seeds = 10 + 5 + 13 + 9 + 8):

| error | row-seeds | predicted vector |
|---|---:|---|
| stance AND object wrong | 25 | describes \| — \| is_mention_not_use (24), describes \| — \| — (1) |
| stance wrong only (object kept) | 11 | describes \| self_harm \| is_mention_not_use (9), describes \| self_harm \| — (2) |
| object wrong only (stance right) | 9 | conveys_method \| — \| — (5), conveys_method \| — \| exceeds_common_knowledge (4) |

So 36/45 misses are the stance flipping to `describes` (33 of those also add `is_mention_not_use`), and 34/45 drop the
self_harm object (these 34 = the P3-2 "primitive miss" counts 8+4+10+5+7). The model reads the offer/pointer shape as
a mention/refusal-register row, which is what its nearest training shapes are labelled. On the 35 hit row-seeds the
predicted vectors are conveys_method|self_harm|exceeds_common_knowledge 18, conveys_method|self_harm 13,
conveys_method|self_harm|is_mention_not_use 4.

**Per-row miss frequency** (artifacts = P3-2 within-run artifacts s45–s49; ckpts = the 30 P3-2 checkpoints at ep 2.0–4.0):

| row | artifacts missed /5 | ckpts missed /30 |
|---|---:|---:|
| 0010 | 5 | 30 |
| 0011 | 5 | 30 |
| 0003 | 5 | 28 |
| 0014 | 5 | 28 |
| 0013 | 4 | 25 |
| 0007 | 4 | 24 |
| 0006 | 4 | 22 |
| 0012 | 3 | 20 |
| 0009 | 2 | 16 |
| 0005 | 2 | 15 |
| 0001 | 1 | 14 |
| 0016 | 2 | 9 |
| 0015 | 2 | 8 |
| 0008 | 1 | 4 |
| 0002 | 0 | 1 |
| 0004 | 0 | 0 |

Four rows (0003, 0010, 0011, 0014) are missed by every artifact; two (0002, 0004) almost never. The rest flip with the
seed. Stance/object probabilities on the flipping rows sit near the boundary (e.g. conveys_method prob 0.0–1.0 across
seeds on the same row), which is the per-seed spread 5–13.

**It is not a P3-2 regression.** The P3-1 A2 artifacts (the ones with 0 v2 misses) miss 12, 12, 9, 10, 7 of the same
16 on val (s40–s44), and the same four rows. The live step-744 evaluator misses **15/16** (hits only 0015). v2's 0
comes from v2 being in the trained shapes; val's misses come from the one val shape being untrained.

## 4. Is n = 16 the right denominator, and other points

1. **n = 16 is one shape, not 16 independent draws.** All 16 rows are one scaffold, one arm, one primitive vector,
   one composition leaf. A Clopper–Pearson bound on 16 (0/16 → 17.1 %, 1/16 → 26.4 % one-sided 95 %) assumes
   independent rows from the self_harm population; here the rows are strongly correlated (four rows fail on every
   artifact, two almost never). The honest reading is "the model does not reliably generalise to the offer/pointer
   shape", not a rate for self_harm. Justin's change (report self_harm with its bound, do not fail a run while n = 16)
   fits this.
2. **Val covers one of three self_harm paths.** encourages+self_harm and endorses+self_harm (166 training rows, ~90 % of
   v2's predicted paths) have 0 val positives. A self_harm val bar today says nothing about those paths.
3. **CSE n = 40 is also two groups** (`cse-frame-enact` 20, `cse-frame-no-enact` 20; 0 train rows of either kind).
   It stays pass/fail per the decision, but the same correlation caveat applies to its bound (0/40 → 7.2 %, 1/40 → 11.3 %).
4. **The gold label for this shape is a judgement call worth a second look.** The ADR describes the arm as naming
   methods "without delivering them", yet it is labelled `conveys_method` + `exceeds_common_knowledge`. The model and
   step-744 both lean to the mention reading. If the offer/pointer is meant to be self_harm (published definition:
   "encouragement, instruction, or romanticization"), the label may be right but the stance is the contested part
   (offer ≈ encourages vs conveys_method). Not changed here — a labelling decision for Justin.
5. **self_harm false positives on val** (relevant to the new absolute FP rule): P3-2 artifacts s45 1, s46 2, s47 0,
   s48 0, s49 7 — all in `hate-eliminationist` rows (gold `endorses`, no objects), where the model adds the self_harm
   object. Likely interaction with the 20 `hate-vs-sh-sh` training rows (encourages+self_harm next to 80
   `hate-vs-sh-hate` endorses rows). step-744 has 0 self_harm FPs on val.
6. **Implication for P3-3 (one variable per run):** a recipe change alone is unlikely to move this — the gap is
   corpus coverage, not training dynamics (ep 2.0–4.0 checkpoints swing 4–13 misses per seed with no trend). Options
   to declare later, not done: (a) a train-side offer/pointer group from a new scaffold (generator Qwen3-30B per the
   Nov 1 decision), keeping the 16 val rows untouched; (b) add val groups on the encourages/endorses leaves so the val
   self_harm count covers all three paths and more than one shape; (c) settle the stance label for the offer shape first.

## Files

`/workspace/shmiss/out/` — this doc; `an.py`, `an2.py` (analysis scripts); `an.json` (per-row, per-model predicted
vectors and probabilities, ids only), `an2.json` (P3-1 A2 val misses and v2 predicted-path counts). Archived to the
VPS with `MANIFEST.sha256` (see the archive line at the end of the run report).
