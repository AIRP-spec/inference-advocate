# R-24 item 1 / item 2 record for hx-t19 attach (evidence only; NOT adopted). Counts, ids, hashes only.

Posted 2026-11-23 from the box checkout `/workspace/wt-p3` (HEAD 58d766c4857a24b47764850cc621a96022191dfe, clean `git status --porcelain`).

## Item 1: what ran the attach
- `hx-t19.attach-prior-skip.diff` (this directory) is the diff against `ffc973e` that the box held as `/workspace/hx-t19-notes/attach-prior-skip.patch` (written 02:52:06Z, two minutes after the attach started at 02:50:50Z). It adds an `if a.attach:` loop in `main()` that logs `ATTACH PRIOR hx-sNNN: VPS outputs+weights sha256sum -c OK -> left alone` (t247u comment in the hunk).
- Applied to the pinned `headext_pod_train.py` (git blob b1d4a3e2..., sha256 ab769216...) the diff applies cleanly and yields blob 2883999ca64ecb66118fdb7e8649d0cbd5826516 (matches the diff's `index` line) and sha256 91435df66c293b04fa5d12ac18cc45573bf12bbf34fe7d5260ff11ced232198c.
- Therefore the program that emitted the two `ATTACH PRIOR` lines (02:50:55Z, 02:51:00Z) was `decide/shared-adopt/phase3/headext/headext_pod_train.py` as locally modified by that diff, run as `--attach --name hx-t19`. That is NOT the pinned driver. The modified file itself was not kept on the box (the working tree is clean and the pinned file at HEAD hashes to ab769216...); pid 7545 no longer exists, so its executed bytes cannot be hashed directly. The hash above is a reconstruction (pinned + diff), not a measurement of pid 7545.
- This contradicts the report's wording that the driver run was the pin for the attach segment. The first segment (01:46 to 02:44Z, original supervisor) is not shown to have run modified code.
- Effect on data: the added code only reads the VPS and sets `pulled`, `WDONE`, `res["seeds"]` for s105/s106; it does not write or delete anything.

## Why the s105/s106 box copies are gone
Unexplained. No driver command or history line removes them (the pinned and the modified driver have no `rmtree`/`rm`/`unlink` on box paths; `rm -rf` exists only in the in-pod deletion-list shell, driver line 86-93). Facts found: the box checkout files under `/workspace/headext-train` carry creation times 2026-11-23 02:47:31Z (state.json, driver.log of hx-t18/hx-t19), directory mtimes 02:45-02:47Z, and `uptime -s` is 03:27:19Z, i.e. the box was replaced/restored/restarted during the hx-t19 run (supervisor lost at 02:44Z). Box copies for hx-t15 to hx-t18 are also absent (only driver.log, result.json, state.json, watchdog.log remain), so absence of box copies is not specific to s105/s106. Most likely the restore did not carry the s105/s106 trees; this is a reading, not a verified cause.

## Item 2: re-anchor s107 and s108 to the pod's own sums (VPS train-hx-t19)
- hx-s107, 04:27:51Z to 04:27:57Z: `sha256sum -c --quiet out/hx-s107.sha256` clean (rc 0); `cd keep && sha256sum -c --quiet hx-s107-final.sha256` clean (rc 0).
- hx-s108, 04:27:57Z to 04:28:04Z: `sha256sum -c --quiet out/hx-s108.sha256` clean (rc 0); `cd keep && sha256sum -c --quiet hx-s108-final.sha256` clean (rc 0).
