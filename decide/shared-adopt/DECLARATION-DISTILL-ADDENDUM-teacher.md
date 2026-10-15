# Addendum to DECLARATION-DISTILL (`51e4cc03…`): teacher targets pinned before the pod

- Teacher integrity: all 5 ckpts re-run on held-out v2 on the VPS CPU match their archived logits. Max |diff| is 7.7e-4 (well under the 1e-2 bound), with 0 decision differences on 471/471.
- `ens5-train-soft.jsonl` sha256 **`7a428e8d653c494a0da566b0f03828dda949e1c4a990a793539d60d24ccf8d36`**. It has 7332 rows, and its ids equal train.jsonl exactly: 0 overlap with val (819) and 0 with held-out (471). Computed on the VPS CPU from 10:59 to 12:01Z under flock.
- Teacher checkpoint shas: see `distill-pack/teacher/teacher-ckpts.sha256`.
- `pod_pipeline.sh` checks this sha and refuses to train on a mismatch.
