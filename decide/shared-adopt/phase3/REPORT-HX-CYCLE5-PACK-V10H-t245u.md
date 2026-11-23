# Pack data-v10h (R-11 step 4, $0)

Recorded 2026-11-22 NPT (Asia/Katmandu, UTC+5:45). Draft PR #35. Built per the **draft** `DECLARATION-HX-CYCLE5-t245u.md` (commit `27046eda`); not in force until the reviewer confirms it. No pod, no spend, no generation. No row text read; ids, groups, counts and shas only. Cumulative GPU unchanged at $53.242.

Builder `headext/cycle5/build_cycle5_split.py` (CPU, pure re-assignment of v10g rows, bytes unchanged). Source v10g train `dd9f7841...`, val `cffe5521...` (pins asserted).

## Result
- Train **9,360** sha256 `3a5e059d11272552715e15ce67fc7695c9ecc48979387ad942ba151900f86b8b`
- Val **1,879** sha256 `cb38ee4ceaae98e3adbfa19e394e6ed057e9f45693743631a4a69fa235013977`
- `split-meta-v10h.json` sha256 `6f1425e65ea9aec39164ff2591eb00c1b267818a45fbff4f3cd33d808a37ec96` (committed: `headext/evidence/cycle5/split-meta-v10h.json`)
- Training pack `PACK.sha256` file sha `e0ceb28d0eeb1b2742ba336e49ef199d7819a0e83e5da15c6abea96cf3537a64`; tgz sha `3cbc67607f3c0c219149991fd2614692768a1e9f55bb74880afa14a8f93bdaad`
- Rows moved: 35 val->train (`self-harm-named-method-offer` 16, `offer-terse` 16, `offer-terse-refusal-neg` 3); 30 train->val (`offer-colloquial`, the drawn group: sha256 of `airp-hx-cycle5-t245u|offer-colloquial` `28087c9a...` < clinical `a067865b...`).
- Two independent builds, `data-v10h-1` and `data-v10h-2`: train, val, split-meta, `PACK.sha256` and the training tgz byte-identical (`diff -r` and `cmp` clean).

## Held-out groups (validation, 0 train rows) and counts
| class | val pos | val neg | train pos | in-distribution val groups | held-out val groups |
|---|---|---|---|---|---|
| self_harm | 82 | 1,797 | 264 | `self_harm-imperative` 8, `self_harm-encouragement` 10, `self_harm-method` 10, `hate-elim-vs-self-harm` 8, `offer-clinical` 8 | `offer-colloquial` 38 |
| child_sexual_exploitation | 66 | 1,813 | 564 | `cse-act-as-undress` 10, `cse-numeric-age` 8, `cse-roleplay` 8 | `cse-framing-vs-enact` 40 |

Split-rule checks passed in code: self_harm val positives span 6 groups, 5 with train rows; >= 1 held-out group each class; held-out groups have 0 train rows; no id on both sides; id set preserved; 0 exact-content duplicates across sides; no stored class key on val rows. Held-out ids per class are in `split-meta-v10h.json` (`held_out_ids`).

## Archive
VPS `/root/primitives-evaluator/headext-20261102/pack-v10h` (new, empty before): `train.jsonl`, `val.jsonl`, `split-meta-v10h.json`, `train-pack-v10h.tgz`, `PACK.sha256`, `build_cycle5_split.py`, `SHA256SUMS`. `sha256sum -c SHA256SUMS`: 6/6 OK.

## Not done
No scorer change (point P-b of the declaration), no smoke test, no pod. Pre-pod check waits for reviewer confirmation.
