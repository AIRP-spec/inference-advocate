# ADR 2026-10-19: validation gold classes are derived, never stored

Date: 2026-10-19
Status: **Accepted**, effective 2026-10-19 17:12 NPT (Justin Flores, t165u), before any Phase 3 pod
Decided by: Justin Flores

## Context

The validation split (819 rows, sha256 `346d6ba4cf2f608f3fa5b031facb96636219856f4030bc4bf0f7525e23e15f28`, identical
in every pack since data v5 and in `decide/shared-adopt/round/val.jsonl`) stored class labels next to the gold
primitives: `expect` (class list), `verdict` (11-class y/n string) and `class` (family target class).
For **72 of 819 rows** the stored `expect` disagrees with composing the row's own gold primitives under composition
2a (`59ddf1f6…`):

| kind | rows | disagreement |
|---|---:|---|
| cse-alone-age-marker | 32 | `child_sexual_exploitation` stored, not derived |
| cse-frame-enact | 20 | `sexual_content` stored only |
| rh-denial | 20 | `relational_hooks` derived only |

Selection F1 (`decide/step4/scripts/select-composed-f1.mjs`) compares composed predictions with the **stored**
`expect`, so every model shows about 33 spurious CSE "misses" on val and every val macro-F1 is depressed.

## Decision

1. **No stored class labels in validation data.** `expect`, `verdict` and `class` are removed from every row
   (`decide/shared-adopt/phase3/strip_val_labels.py`; all other fields unchanged). New file:
   `decide/shared-adopt/round/val.jsonl`, sha256 **`5be292a911f0082a74c6e24beb20a60455fab4a86baded561784d37f2b453009`**
   (819 rows). The legacy file stays in git history (fcc5b5d) and in the VPS archive for reproducing past records only.
2. **Classes are derived at load time** from the gold primitives through composition 2a by
   `decide/shared-adopt/phase3/val_gold.mjs`, which **asserts**: composition sha = 2a; val sha = the pin above;
   no row carries `expect`/`verdict`/`class`/`expect_classes`/`classes`; ids unique; stance and every primitive name
   in the 2a heads, except the declared non-head name `criminal_assistance` (20 rows), which is asserted to change no
   derived class. Selection uses `phase3/select-composed-f1-derived.mjs` (same metric and tie-break as before).
   Checks run 2026-10-19: Node derivation == Python `airp_v3` derivation on 819/819 rows; derived ≠ legacy stored on
   exactly 72 rows; the loader refuses the legacy file (stored key), a wrong val sha and a non-2a composition.
3. **Every validation F1 used for selection to date was affected** (72/819 rows with inconsistent stored gold):
   the step-4 and round selections, FRESH-05 … FRESH-10, the stability sweep, distillation/arm-B and the research
   release selection.
4. **Those selections stand.** Each followed the rule declared before it ran (val composed macro-F1 against the
   stored `expect`, pinned by val sha `346d6ba4…`). They are not re-run or re-ranked.
5. **From Phase 3 on**, every declaration pins val sha `5be292a9…` and the derived-gold selection script.

## For the record (informational, changes no decision)

Val macro-F1 of the nine averaged artifacts, stored vs derived gold (2a, 0.5/argmax):

| artifact | stored | derived |
|---|---:|---:|
| avg-f05-s12 | .7747 | .7896 |
| avg-f05-s13 | .8074 | .8175 |
| avg-f05-s14 | .8021 | .8177 |
| avg-f06-s15 | .7841 | .8018 |
| avg-f07-s18 | .8315 | .8532 |
| avg-f07-s19 | .7703 | .7849 |
| avg-f07-s20 | .7591 | .7737 |
| avg-f08-s21 | .7854 | .7979 |
| avg-f09-s24 | .7782 | .7931 |

Derived F1 is higher by .010–.022. Rankings within each run are unchanged except the s13/s14 averages of f05, which
are within .0002 under derived gold (s14 ahead) and .0053 under stored (s13 ahead); the research-release choice
(s14 over s12) is the same under both.
