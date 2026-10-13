# Task 2 round verification

- labels v5 sha256: `9480a89f0ca4424be8c0ba26b803c77a00bbf78d2c6d37301589c5bb9a99ae86`
- corpus sha256: `21e44393383c1de5893ddf2f2754e48c5bd5cb71506fb73bc7bec7e0c42130d0`
- Arithmetic: 8056 (v4) + 96 new = 8152; of the 8056, 20 hate-vs-sh-sh relabelled, 8036 unchanged.
- Diff vs v4: exactly those 20 + 96 new. Verified by `work/diff_labels.py`.
- Dup-id: pass (8152 unique).
- Leak vs v2 + v1-207: 0 hits on the 96 (after rewriting one aon-plain sentence that ngram-collided; see contrast-r13-aon-neg.json).
- Split: val 819 ids unchanged; 96 new rows → train only (units g:r13-*); train 7332.
- Justin option A recorded in DECLARATION-3.md and PROGRESS.md.
