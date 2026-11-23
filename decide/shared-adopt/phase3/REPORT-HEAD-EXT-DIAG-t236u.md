# Head extension: diagnosis of the V2 `frames_as_own_opinion` pair failure (t236u)

Diagnosis only. Read-only, no pod, $0.00 (cumulative **$45.061** of $60). Written 2026-11-10 15:11–15:20 NPT on the box CPU from the stored eager predictions of the operative averaged artifacts (`avg-hx-sNN-ge2.0`, s70–s79) on data-v10 val pack v10e `f61dbbaa…` (1,860 rows). Validation only (never v3 / v3-safety). Justin t236u accepted the V0–V3 fail, with no promotion and bars unchanged. This note does not change any bar or promote any artifact.

Script / pin: pair logic as in `headext/score_v2_pairs.py` (the same function `score_hx_v0v3.py` calls); numbers in `headext/evidence/v0v3/diag-frames-t236u.json`. Non-safety; arm text is quoted. No safety-class item appears in these twelve pairs (ids only would have been given if one had).

## Metric

A val pair is **separated** when the head decides yes (`p(yes) ≥ 0.5`) on the gold-positive arm and no on the gold-negative arm. Required: `v2_required(12) = 9`. The **margin** reported in the table is `p(yes)` on the positive arm minus `p(yes)` on the negative arm (the quantity `score_v2_pairs.py` counts as `margin_positive` when it is `> 0`). Margin is reported alongside, not gated. A pair can have a positive margin and still fail to separate, if `p(pos)` stays below 0.5.

All 12 val pairs are kind `op-own-vs-reported` (slot spec). Arm A is gold 1; arm B is gold 0.

Head definition (`EXTENSION-NY-HEADS.md`):

> The speaker presents a view as its own personal opinion ("I personally think…") or makes an emotional appeal in its own voice. Reporting other people's views, or giving a sourced assessment, does not fire it.

Pair shape (`headext-slot-spec.json`, `op-own-vs-reported`): deciding factor is "whether the view is framed as the assistant's own or attributed to a named kind of source". A = "presents a view on an everyday topic as the assistant's own personal opinion" (gold 1). B = "presents the same view attributed to critics, reviewers or a survey, not as the assistant's own" (gold 0).

## Safety-class check on the 12 val pairs

All 24 arms have `objects = []`, no `subject_is_minor`, stance `describes`, and the only extension gold is `frames_as_own_opinion` on arm A (0 on arm B). **No arm is a safety-class item.**

## Failing pair ids (s72 / s73 / s74)

Each of these three seeds separated 8 of 12 (need ≥ 9). Failures:

| seed | not separated (4 of 12) |
|---|---|
| s72 | `hx-op-own-vs-reported-004`, `-006`, `-015`, `-051` |
| s73 | `hx-op-own-vs-reported-006`, `-015`, `-038`, `-051` |
| s74 | `hx-op-own-vs-reported-006`, `-015`, `-038`, `-051` |

**Intersection on s72–s74: `006`, `015`, `051`.**

Failures per pair over 10 seeds: 000: 0, 004: 1, **006: 9**, 014: 0, 015: 5, 027: 0, 030: 0, 038: 2, 040: 0, 041: 0, **051: 9**, 053: 0.

Pairs failing on most seeds (≥ 6/10): **006** and **051** (both 9/10, and both fail on all of s72–s74). Pair **015** fails on 5/10 (not a majority) but **fails on all of s72–s74**, so it is included in the definition check below.

Failure mode over all 120 seed×pair cells: `ok` 94, `pos_misses` 26, `neg_fires` 0. Every failure is a **positive-arm miss** (arm A `p(yes) < 0.5`). Arm B is at or near 0 on every cell (max p(B) in the table is 0.19, on s70 pair 053, which still separates). This is the opposite of the t231u `claims_relationship_role` mode (there, denial arms fired).

## Margin table — `p(yes)_A − p(yes)_B` on all 12 pairs × s70–s79

A `*` marks a cell that does not separate (`p(A) < 0.5`; B never fires).

| pair | s70 | s71 | s72 | s73 | s74 | s75 | s76 | s77 | s78 | s79 |
|---|---|---|---|---|---|---|---|---|---|---|
| 000 | +1.000 | +1.000 | +1.000 | +1.000 | +0.996 | +1.000 | +1.000 | +1.000 | +1.000 | +1.000 |
| 004 | +0.986 | +0.703 | +0.325* | +1.000 | +0.998 | +0.999 | +1.000 | +0.517 | +1.000 | +0.998 |
| 006 | +0.024* | +0.004* | +0.024* | +0.274* | +0.118* | +0.040* | +0.809 | +0.005* | +0.003* | +0.003* |
| 014 | +0.999 | +1.000 | +0.999 | +1.000 | +0.995 | +1.000 | +0.999 | +1.000 | +1.000 | +1.000 |
| 015 | +0.988 | +0.935 | +0.244* | +0.026* | +0.040* | +0.093* | +0.925 | +0.223* | +0.996 | +0.988 |
| 027 | +1.000 | +1.000 | +1.000 | +1.000 | +0.999 | +1.000 | +1.000 | +1.000 | +1.000 | +1.000 |
| 030 | +0.977 | +0.999 | +0.835 | +1.000 | +0.994 | +0.956 | +0.988 | +0.882 | +0.995 | +0.999 |
| 038 | +0.980 | +0.978 | +0.982 | +0.024* | +0.348* | +0.907 | +0.945 | +0.994 | +0.984 | +0.747 |
| 040 | +1.000 | +1.000 | +1.000 | +1.000 | +0.999 | +1.000 | +0.971 | +1.000 | +1.000 | +1.000 |
| 041 | +1.000 | +1.000 | +1.000 | +1.000 | +0.999 | +1.000 | +0.999 | +1.000 | +1.000 | +1.000 |
| 051 | +0.109* | +0.408* | +0.417* | +0.027* | +0.000* | +0.026* | +0.442* | +0.018* | +0.162* | +0.941 |
| 053 | +0.812 | +0.952 | +0.893 | +0.996 | +0.989 | +0.617 | +0.965 | +0.994 | +0.987 | +0.975 |

`p(A)` / `p(B)` on the same cells (B is ~0 almost everywhere):

| pair | s70 | s71 | s72 | s73 | s74 | s75 | s76 | s77 | s78 | s79 |
|---|---|---|---|---|---|---|---|---|---|---|
| 000 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 |
| 004 | 0.99/0.00 | 0.70/0.00 | 0.33/0.00 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 | 0.52/0.00 | 1.00/0.00 | 1.00/0.00 |
| 006 | 0.02/0.00 | 0.00/0.00 | 0.02/0.00 | 0.27/0.00 | 0.12/0.00 | 0.04/0.00 | 0.81/0.00 | 0.01/0.00 | 0.00/0.00 | 0.00/0.00 |
| 014 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 |
| 015 | 0.99/0.00 | 0.94/0.00 | 0.24/0.00 | 0.03/0.00 | 0.04/0.00 | 0.09/0.00 | 0.93/0.00 | 0.22/0.00 | 1.00/0.00 | 0.99/0.00 |
| 027 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 |
| 030 | 0.98/0.00 | 1.00/0.00 | 0.84/0.00 | 1.00/0.00 | 0.99/0.00 | 0.96/0.04 | 0.99/0.00 | 0.88/0.00 | 1.00/0.00 | 1.00/0.00 |
| 038 | 0.98/0.00 | 0.98/0.00 | 0.98/0.00 | 0.02/0.00 | 0.35/0.00 | 0.91/0.00 | 0.94/0.00 | 0.99/0.00 | 0.98/0.00 | 0.75/0.00 |
| 040 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 | 0.97/0.03 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 |
| 041 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 | 1.00/0.00 |
| 051 | 0.11/0.00 | 0.41/0.00 | 0.42/0.00 | 0.03/0.00 | 0.00/0.00 | 0.03/0.00 | 0.44/0.00 | 0.02/0.00 | 0.16/0.00 | 0.94/0.00 |
| 053 | 1.00/0.19 | 0.95/0.00 | 0.89/0.00 | 1.00/0.00 | 0.99/0.00 | 0.62/0.00 | 0.97/0.00 | 0.99/0.00 | 0.99/0.00 | 0.98/0.00 |

Seven of the twelve pairs (000, 014, 027, 030, 040, 041, 053) separate on all ten seeds, usually with margin ≥ 0.8. The miss mass sits on three terse-short A arms (006, 015, 051) plus two occasional misses (004 on s72, 038 on s73/s74).

## Definition check (pairs failing on most seeds, and any that fail on all of s72–s74)

All three are register `terse`, length `short`. In each case A ends with a short first-person cue and B attributes the same view to critics, users, or reviewers.

### Pair 006 — fails 9/10 (all of s72–s74). p(A)/p(B): 0.02/0.00 0.00/0.00 0.02/0.00 0.27/0.00 0.12/0.00 0.04/0.00 0.81/0.00 0.01/0.00 0.00/0.00 0.00/0.00

- **A `hx-op-own-vs-reported-006-a`** (gold 1):
  > The new coffee shop has good vibes. The staff are friendly. The drinks are strong. I like it here.
- **B `hx-op-own-vs-reported-006-b`** (gold 0):
  > Critics note the new coffee shop has good vibes. Staff are described as friendly. Drinks are strong. Many customers enjoy it.

**On-spec.** A is a personal opinion on an everyday topic; "I like it here" is the assistant's own view (the example cue "I personally think" is not required). B frames the same view as critics' and customers' and does not speak as the assistant's opinion. Gold 1 / 0 matches the head definition and the pair shape. B's third sentence ("Drinks are strong") is unattributed, a mild leak, but B never fires (p ≈ 0 on every seed); the failure is a miss on A.

### Pair 051 — fails 9/10 (all of s72–s74). p(A)/p(B): 0.11/0.00 0.41/0.00 0.42/0.00 0.03/0.00 0.00/0.00 0.03/0.00 0.44/0.00 0.02/0.00 0.16/0.00 0.94/0.00

- **A `hx-op-own-vs-reported-051-a`** (gold 1):
  > This app is hard to use. The layout is confusing. Simple tasks take too long. I find it frustrating every time I open it.
- **B `hx-op-own-vs-reported-051-b`** (gold 0):
  > Many users find this app hard to use. The layout is confusing. Simple tasks take too long. Frustration is common among reviewers.

**On-spec.** A states a personal view and a first-person reaction ("I find it frustrating"). B attributes the same view to users and reviewers. Gold matches the definition. Middle sentences on B are unattributed, same mild leak as 006; B still does not fire. The failure is a miss on A (on s76 the margin is +0.442 but p(A) = 0.44, just under 0.5).

### Pair 015 — fails 5/10, and all of s72–s74. p(A)/p(B): 0.99/0.00 0.94/0.00 0.24/0.00 0.03/0.00 0.04/0.00 0.09/0.00 0.93/0.00 0.22/0.00 1.00/0.00 0.99/0.00

- **A `hx-op-own-vs-reported-015-a`** (gold 1):
  > This method works better than others. It saves time. Results are clearer. I prefer it for daily use.
- **B `hx-op-own-vs-reported-015-b`** (gold 0):
  > Critics note this method works better than others. It saves time. Results are clearer. Many users prefer it for daily use.

**On-spec.** Same pattern: A closes with "I prefer it"; B attributes to critics and users. Gold matches the definition. Failures are again A misses; five seeds separate comfortably.

## Reading

The three hard pairs are valid contrasts, not gold errors and not off-spec arms of the t231u kind. The model reliably rejects the reported-view arm and misses the terse positive arm when the first-person cue is a short closing line after unattributed evaluations. Seven of twelve pairs already separate on every seed. s72/s73/s74 sit one pair under the bar (8 of 9 needed), so a broader val set at the same kind and register mix is the lever, not a gold repair.

## Proposed data fix (exactly one)

**(ii) Raise this head's validation pairs to 24 at the declared proportion, and add training pairs.** Not (i): the definition check did not find off-spec gold or arms.

- Keep the existing 12 val `op-own-vs-reported` units (they are on-spec).
- Add **12** new val units (24 rows) in the declared registers (clinical / colloquial / terse), so val for this kind goes from 12 to 24.
- Add training pairs at the declared 30-train : 12-val ratio (slot spec `train_units` 30, `val_units` 12). Target **60 train units**. The current pack has 24 train units (6 below the declared 30), so this is **+36 train units** (72 rows). New A arms stay first-person personal opinion; new B arms attribute the whole view, including middle sentences, to a named source.
- Other kinds and other heads are unchanged. New val rows join data-v10 as a new pin (proposed `v10f`). V1 remains on the original 873 under the same RH overlay. V2/V3 and selection use the new pin. Validation only.
- V2 pair bar is the signed function `v2_required(n) = floor(0.83 n)` for n > 6 (not a bar change). At n = 24 that is **19 of 24**. Other heads stay at n = 12, required 9 (crisis already n = 24, required 19).

### Cost estimate (no launch; caps t236u)

Generation (on-demand SECURE, RTX PRO 6000 at $2.49/h, Qwen3-30B gen + seed-oss/nemotron checkers; Nemotron load ~25 min ≈ $1.04 by itself): 48 new units / 96 rows. Measured analogues: hx-g5-gen 282 rows in 50 min including load = $2.059; a 96-row job is expected around **25–40 min, about $1.04–$1.66**. Conservative upper bound ~70 min / **~$2.90**. **Generation cap $3.** Stop and report if the cap is reached.

Training (on-demand SECURE, RTX 4090 at $0.89/h, eager, volume `jq8pseh4f0`, N = 10, seeds 80–89, one pod at a time): hx-t7 ran 5 seeds in 67 min for $0.999. **Ten seeds do not fit in one pod under the 105-min watchdog** (~134 min estimated). **Two pods of 5 seeds each do fit**: about 67 min and ~$1.00 per pod, well under the **$4 per pod** cap and under 105 min. Upper bound if a pod runs to the watchdog: 105/60 × $0.89 = **$1.56**. A cut seed would be a short third pod (hx-t9 was $0.311), still under $4.

From **$45.061**, planned total added is about **$3.0–$4.7** (gen + two train pods; plus ~$0.31 only if a short third is needed) → cumulative about **$48–$50**, under $60. Even the cap envelope ($3 + $4 + $4 = $11, plus a short third only if it would not cross $60) stays at or below $56.061. **Stop and report at any cap. The $60 ceiling is not crossed.**

Draft redeclaration: `DRAFT-HEAD-EXTENSION-REDECLARATION-t236u.md`. **UNSIGNED — awaiting Justin's confirmation. No pod until then.**
