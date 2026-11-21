# hx-t14 (pod three, seed 94 alone), R-5 instruction 5/6. Counts only.
Pod w1kbdvljmsmgry, on-demand SECURE RTX 4090 EU-RO-1, vol jq8pseh4f0, 34.0 min, $0.516, balance $35.025 -> $34.508, cumulative GPU $52.185.
Prune: 21 entries deleted in pod (20 closed-cycle seed dirs 1.7G each + partial hx-t13/hx-s94 790M), see result record vol_prep. In-pod `df` after prune read 480258G (it reports the host filesystem, not the 60 GB quota), so the df-based refusal cannot trigger on this volume; estimated free by quota arithmetic ~35 GB. Quota-aware check (min(df, 60 - du)) added in a188d43 before pod two.
Seed 94: VOL_OK 43 files, box 43 files and VPS outputs 29 + weights 14 sha256sum -c clean, pod terminated after archive verified.
