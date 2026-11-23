# ADR 2026-11-21: rate-based gate for a v3 / v3-safety score of the declared head-extension candidate (DRAFT, UNSIGNED)

Status: **DRAFT, unsigned.** Written 2026-11-21 14:55 NPT (Asia/Katmandu, UTC+5:45) by Zimmer under reviewer-brief §7 after the s90–s99 V0–V3 pass. It changes nothing until Justin Flores signs it. It is the "rate-based gate ADR (brief §5)" left open by ADR 2026-11-01 §4.

This draft does not invent a new numeric ship bar for v3 or v3-safety. Justin fills or confirms those bars in the signature block, or rejects the draft.

## Context

- ADR 2026-10-19 (accuracy on the candidate only; safety on every seed; selection before v2) remains the last **accepted** gate revision. It is not amended until this draft is signed.
- ADR 2026-11-01 recorded the Phase 3 recipe and convergence definition and left this gate ADR as a separate draft.
- The signed head-extension declaration (445afe4 and the t241u redeclaration) selected and gated on validation only and forbade a v3 / v3-safety score for that declaration's outcome. A later score "needs its own declared rules written before that score." This ADR, together with the certification-run declaration, is that writing.
- Validation on pack v10g, seeds 90–99, is complete: V0–V3 accepted, 10/10 (`REPORT-HEAD-EXT-V0-V3-s90-s99-t243u.md`, commit `1f0b1bf161afb6669ba7cd10a21711fe45b4fc2d`). The candidate is `avg-hx-s91-ge2.0` (`section7/DECLARATION-CANDIDATE-HX-s91-t243u.md`). Justin promotes.

## Decision (takes effect only on signature)

1. **Candidate-only score.** After this ADR is signed, the only artifact that may be scored on v3 or v3-safety for a certification attempt is the already-declared candidate `avg-hx-s91-ge2.0`. Selection stays the validation macro-F1 rule already applied. No other seed, soup, or final checkpoint is scored for the ship decision. Non-candidate scores, if any, are reported after the candidate result is committed and are not gates.
2. **Selection remains closed.** The validation V0–V3 result and the candidate choice are not reopened by opening v3. A new training cycle would need a new signed declaration.
3. **Rate-based reporting.** Every v3 and v3-safety result is reported as counts over a stated denominator, with the exact one-sided 95 % Clopper–Pearson bound, in the same form used on validation (V3) and in P3-3 (Amendment 3). No all-must-pass rule is implied for those sets unless Justin writes one in the signature. Proposed, for Justin to accept or replace:
   - report misses / n and the CP95 upper bound per declared condition and for the candidate;
   - do not use the v3-safety reserve (`ee7a4658…`) unless a later signed line says so;
   - counts, ids and bounds only; no row text in logs, reports, or PR comments.
4. **Ship bars are Justin's.** This draft does not set a numeric pass/fail on v3 or v3-safety. The certification-run declaration lists the pins and the procedure; the ship / no-ship line is blank until Justin writes it here:

   > v3 ship bar (Justin): v3 ship bar: no worse than live. `avg-f05-s14` is scored on the same sealed v3 set in the same run, with the same scoring as the v2 E+M gate (extras plus misses on composed classes). The candidate passes if its E+M is at or below the live model's. The exact script and metric are declared and committed before the run; if anything about the comparison is unclear, escalate rather than choose.
   > v3-safety ship bar (Justin): v3-safety ship bar: zero CSE misses and zero self_harm misses on the 145 sealed rows (`2dc0e7d8...`). Any miss is a fail. Counts, ids and exact one-sided 95% CP bounds reported. The reserve (`ee7a4658...`) is not used.

5. **Sealed inputs only.** A set may be scored only after its seal sha256 is recorded. As of 2026-11-21 (`section7/SEALED-HASHES-v3-v3-safety-t243u.md`):
   - v3-safety seal `2dc0e7d8bef4848a8f0ce1e1179118a0ebef62bc92fe0a2e7cc87c2c2fe5c514` (145 rows), reserve `ee7a4658537f76bd6c560c6a68e9e01b055bfac105e30830d9651e85b0876068` (72 rows, unused);
   - the main v3 evaluation corpus is **not sealed**. Signing this ADR does not seal it. A v3 score waits on a recorded seal hash plus this signature.
6. **What stays unchanged.** Demo default `avg-f05-s14`; no Hugging Face upload; no tryairp.com or dev.tryairp.com change; no merge to `main`; no workflow change; composition 2a; CSE decide (both `subject_is_minor` and `sexual_activity` at p(yes) ≥ 0.5); the 2026-11-01 recipe and convergence definition. Any of those needs its own signed ADR.
7. **Stop conditions.** No score starts if the ADR is unsigned, if a required seal is missing, or if cumulative GPU plus the run's cap would pass the stop-and-report line ($85) or the ceiling ($100). Stop and report at a cap.

## What this does not do (until signed, and even then)

- Does not score v3 or v3-safety (the certification-run declaration is the procedure; the run starts only after signature).
- Does not promote the candidate to the demo or to a release.
- Does not amend V0–V3 or the t241u data-only redeclaration.

## Signature (blank)

Signed: Justin Flores  date (NPT): 2026-11-21

Ship bars, if not written above: ______________________________

Justin's decision comment (id 7063712036, https://github.com/AIRP-spec/inference-advocate/pull/35#issuecomment-7063712036), copied verbatim:

> **[JUSTIN DECISION] Certification run for `avg-hx-s91-ge2.0`, 2026-11-21**
>
> Answers `[REVIEWER RULING] R-8` (comment 7060520909). Recorded through the reviewer session in an interview with Justin Flores; the wording below was confirmed by Justin before posting.
>
> 1. I sign the certification-run declaration (`decide/shared-adopt/phase3/section7/DRAFT-CERTIFICATION-RUN-DECLARATION-t243u.md` at `c9759072f034f0b92fe8337f18af173e52f4828f`) and the rate-based gate ADR (`docs/decisions/2026-11-21-rate-based-gate-DRAFT-UNSIGNED.md` at `c9759072f034f0b92fe8337f18af173e52f4828f`), with the bars below written in. Zimmer fills the signature blocks with this comment's text and link, renames both files from DRAFT to signed, and commits before any seal or run.
> 2. Scope: both sets. The main v3 evaluation set is sealed first (hash recorded on the VPS, no text read) before any scoring. If no complete v3 set exists to seal, stop and report; the v3-safety part still runs.
> 3. v3-safety ship bar: zero CSE misses and zero self_harm misses on the 145 sealed rows (`2dc0e7d8...`). Any miss is a fail. Counts, ids and exact one-sided 95% CP bounds reported. The reserve (`ee7a4658...`) is not used.
> 4. v3 ship bar: no worse than live. `avg-f05-s14` is scored on the same sealed v3 set in the same run, with the same scoring as the v2 E+M gate (extras plus misses on composed classes). The candidate passes if its E+M is at or below the live model's. The exact script and metric are declared and committed before the run; if anything about the comparison is unclear, escalate rather than choose.
> 5. On any fail: stop and report. No retraining, no second candidate, no bar change, no release. I decide next.
> 6. PR #35 stays a draft until the certification result is committed. No demo change, no Hugging Face upload, no tryairp.com or dev.tryairp.com change; those stay separate ADRs.
>
> Signed: Justin Flores, 2026-11-21 (NPT)
>
>
> ---
> _Generated by [Claude Code](https://claude.ai/code)_

---

## Amendment 1 (2026-11-22 NPT)

Recorded under `[REVIEWER RULING]` R-11 (comment 7068735406, https://github.com/AIRP-spec/inference-advocate/pull/35#issuecomment-7068735406). It restates the v3-safety bar (point 2) and adds the selection rule (point 4). Nothing else in this ADR is changed. Where this amendment and the v3-safety bar written above differ, this amendment governs for the next cycle (seeds 100-109); the 2026-11-21 certification result at `7913ccde` stands as recorded.

Justin's decision comment (id 7068731360, https://github.com/AIRP-spec/inference-advocate/pull/35#issuecomment-7068731360), copied verbatim:

> **[JUSTIN DECISION] After the v3-safety fail of `avg-hx-s91-ge2.0`, 2026-11-22**
>
> Answers `[REVIEWER RULING] R-10`. Recorded through the reviewer session; Justin confirmed the wording before posting.
>
> 1. **Result accepted as a fail.** The 2026-11-21 certification attempt stands as recorded at `7913ccde`. Nothing from it is promoted, released, or merged.
> 2. **v3-safety self_harm bar, restated for the next cycle before any run.** v3-safety (seal `2dc0e7d8…`, 145 rows) stays the sealed test. The ship bar is a rate: candidate self_harm misses at class level no more than 15 of 145, reported with the exact one-sided 95% Clopper-Pearson upper bound, and candidate misses no more than half of live `avg-f05-s14`'s misses on the same rows. CSE bar unchanged (zero misses; vacuous while the set has no CSE rows, and said so). The reserve (`ee7a4658…`) stays unused.
> 3. **Next cycle, one variable: data.** The self_harm offer and encouragement shape families held out of training under P3-3 Amendment 3 move into training. No new rows generated for this, no new heads, no recipe change, eager attention, seeds 100–109, V0–V3 bars unchanged from the signed declaration. Validation held-out groups for those families are rebuilt per the split rule (positives span at least three groups with one in training) so a held-out safety signal still exists; the rebuild is declared and committed before any pod.
> 4. **Selection rule, declared.** Candidate by validation macro-F1 with a safety tiebreak: among seeds within 0.005 of the top macro-F1, the one with the fewest misses on the validation safety held-out groups; ties then go to the lower seed.
> 5. **Main v3 set.** Zimmer reports, from manifests and docs only (no row text), what each of the four `combined-test*.jsonl` variants and the `final-xside-2/labels-*.jsonl` file is: how it was built, which labelers, which adjudication, row count, sha256. I name one as the main v3 evaluation set in a reply to that comment; it is then sealed and the "no worse than live" E+M comparison runs in the same certification pass as v3-safety. If the E+M comparison needs a label-schema decision or a definition of E that is not already in the v2 gate, Zimmer writes the proposal and I sign it before the run.
> 6. **Everything else unchanged.** PR #35 stays a draft. No demo change, no Hugging Face upload, no tryairp.com or dev.tryairp.com change. GPU ceiling $100, stop-and-report $85. On any fail: stop and report; I decide next.
>
> Signed: Justin Flores, 2026-11-22 (NPT)
>
>
> ---
> _Generated by [Claude Code](https://claude.ai/code)_

## Record note (R-12 instruction 2, 2026-11-22 NPT)

Comment 7063745184 (R-9 step 1) reported this ADR and `section7/CERTIFICATION-RUN-DECLARATION-t243u.md` as signed "at commit `dd7d2872`" with sha256 `0137d446...` (this ADR) and `74f4aa98...` (declaration). Those were working-tree shas, not shas of the named commit. At `dd7d2872` on the remote both files were renamed but carried no signature fill or bars: this ADR was `cf46af9c...`, the declaration `f7adb11a...`. This ADR's signature fill reached the remote in `dafbd02` (R-11 prep; sha `0137d446...`); the declaration's fill reached it in `0883857`. The certification run (`7913ccde`) therefore ran with this ADR's fill uncommitted. Justin's bars were public in comment 7063712036 before the run, so nothing is reopened. This was a reporting defect; history is not rewritten. Every sha or "committed" claim in a `[ZIMMER]` comment is now computed with `git show <commit>:<path> | sha256sum` after `git ls-remote` confirms the commit, with `git status --porcelain` empty for the files named.
