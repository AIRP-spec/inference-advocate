# R-20 cycle-3 inventory, list, and prune. Counts and ids only.
Fresh VPS sha256sum -c of both sums for s80–s89, UTC_START 2026-11-23T01:07:55Z through UTC_END 2026-11-23T01:08:24Z. All ten: archive present, SHA256SUMS OK(27), SHA256SUMS.weights OK(14). No unexpected cycle-3 partial (train-hx-t10/t11/t12 hold the ten seed dirs plus logs/ only).
Deletion list (box path was /workspace/headext-train/r20/deletion-list-cycle3.txt; also stored here after the pod): ten paths, oldest first, /vol/hx-t10/hx-s80..s84, /vol/hx-t11/hx-s85..s86, /vol/hx-t12/hx-s87..s89. Not on the list: s90–s99, s100–s103.
Inside hx-t18: all ten VOL_DEL 1.7G, VOL_USED_GB 24 (estimate was about 24), VOL_FREE_AFTER 36, VOL_PREP_OK. No VOL_DEL_ABSENT, no off-list VOL_DEL.
Justin approval: see JUSTIN-APPROVAL.txt ("yes go ahead", 6:51 AM NPT 2026-11-23, t246u).
