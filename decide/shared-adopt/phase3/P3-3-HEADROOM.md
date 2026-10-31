# P3-3 headroom: balance, free space and proposed prune list (read 2026-11-01, NPT UTC+5:45)

Read-only. **Nothing has been deleted.** No pod was created to read the volume; the volume figure is derived (below).

## RunPod (GraphQL `myself`, 2026-11-01 01:09:56 NPT)

- `clientBalance` **$56.43** (was $6.90 after P3-2, so a top-up of ≈ $50 happened in between).
- `pods` **[]** (nothing running). `currentSpendPerHr` $0.004 (network-volume storage only). `spendLimit` $80.
- Network volume `rmn62wuuzx` "airp-f05", 40 GB, EU-RO-1.

## Free space

| store | free | how read |
|---|---|---|
| VPS `/` (203.134.250.85, never rebooted) | **204 G** of 490 G | `df -h /`, 2026-11-01 01:10 NPT |
| network volume (40 G quota) | **≈ 16 G (estimate)** | P3-2 pipeline log: 25 G free (40 G − `du`) at its start with p31 (13 G) on the volume; P3-2 then added `p32/` = 8.9 G (VPS mirror `du`). An exact reading needs a pod (CPU pod $0.06/h); it is item 6 of the declaration's checklist. |
| needed by P3-3 | ≥ **22 G** at start (pipeline stop), planning target ≈ 32 G | 10 seeds × (807 MB final + 807 MB artifact) + outputs ≈ 16.3 G kept; checkpoints live on container disk |

## VPS verification of the archives (re-run 2026-11-01 01:10–01:11 NPT)

- `p31/volume/p31/MANIFEST-volume-p31.sha256` sha `246aadf4ea9ba83321eb016fbb222c4ff65ce45f7693b4294269dec3c6b1b72e`:
  `sha256sum -c` **619/619 OK**. Covers `p31/keep/` (15 finals × 6 files + 15 sha files = 105 entries).
- `p32/volume/p32/MANIFEST-volume-p32.sha256` sha `0600ca01ddab898c8b75248b8330b9d2ee168a60b3c5d95e6eb3478de99f4830`:
  `sha256sum -c` **444/444 OK**. Covers `p32/keep/` (78 entries).

## Proposed prune list (volume only; VPS copies stay; NOT executed)

Each deletion is preceded by a fresh `sha256sum -c` of that directory's entries on the VPS, then on the volume, in the
same session.

| tier | volume path | size | why it is safe | VPS verification | free after (est.) |
|---|---|---:|---|---|---:|
| 1 | `p31/keep/p31-A0-s4{0..4}-final` + `.sha256` | 5 × 807 MB | P3-1 losing arm A0 (REPORT-P3-1); used by nothing later | p31 manifest, 619/619 OK 2026-11-01 | ≈ 20 G |
| 1 | `p31/keep/p31-A1-s4{0..4}-final` + `.sha256` | 5 × 807 MB | P3-1 losing arm A1 | same | ≈ 24 G (passes the 22 G start check) |
| 2 | `p31/keep/p31-A2-s4{0..4}-final` + `.sha256` | 5 × 807 MB | P3-1 A2 finals; their last use was P3-2's H0 control (done) | same | ≈ 28 G |
| 2 | `p31/out/` | 364 MB | P3-1 raw outputs, already pulled to the box and in the VPS archive | same | ≈ 28 G |
| 3 | `p32/keep/p32-H1-s4{5..9}-final` + `.sha256` | 5 × 807 MB | P3-2 cross-seed endpoints; cross-seed averaging was not adopted | p32 manifest, 444/444 OK 2026-11-01 | ≈ 32 G |
| 3 | `p32/keep/H1-soup5` + `.sha256` | 807 MB | P3-2 soup, not adopted | same | ≈ 33 G |
| keep | `p32/keep/avg-p32-H1-s4{5..9}-ge2.0` | 5 × 807 MB | P3-2 within-run artifacts = the current recipe's outputs; kept on the volume | – | – |

Recommendation: tiers 1 + 2 (≈ 12.5 G, all P3-1) are enough for the pipeline's 22 G start check with ≈ 6 G margin.
Add tier 3 only to reach the ≈ 32 G planning figure. Deletion needs a pod (the volume is only reachable from one), so it
happens on the CPU pod at the start of the P3-3 window, after Justin's go-ahead.
