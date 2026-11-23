# Draft merge plan: `decide/shared-adopt` into `main`, then PR #35 (UNSIGNED)

**Status: draft for Justin. No merge is performed by this document.** PR #35 (`plan/phase3-recipe-stability`) stays a draft until Justin converts and merges it. Written 2026-11-21 14:55 NPT.

## Current state

- Branch `plan/phase3-recipe-stability`, PR #35, draft. Head as of the V0–V3 evidence commit: `1f0b1bf161afb6669ba7cd10a21711fe45b4fc2d` (plus any later section-7 commit on the same branch).
- The accepted validation result, candidate declaration, unsigned gate ADR, sealed-hash record, this plan, and the certification-run declaration live under `decide/shared-adopt/phase3/` (the ADR under `docs/decisions/`).
- Demo stays `avg-f05-s14`. Nothing is published. No workflow files are in these commits.

## Proposed order (Justin executes, or edits)

1. **Do not merge before reading the unsigned ADR and the certification-run declaration.** Signing those is a separate act from merging.
2. **Documentation-on-main (optional, Justin's call).** If Justin wants the validation record and the drafts on `main` before any certification score, merge PR #35 only after confirming it still contains no workflow change, no demo default change, and no promotion ADR. That merge is how `decide/shared-adopt` lands on `main`.
3. **Or wait.** Leave PR #35 draft until the rate-based gate ADR is signed, the main v3 set is sealed if a v3 score is wanted, the certification run (if any) is finished and committed, and only then merge PR #35 into `main`.
4. **After a merge to `main`:** no automatic demo switch, no Hugging Face upload, no tryairp.com change. Those stay Justin-only ADRs.
5. **If certification fails or is declined:** PR #35 can still land as a record of the validation pass and the drafts, or stay open; Justin decides. The candidate is not promoted either way without a signed promotion.

## What will not be in a merge

- Secrets, workflow files, or generated safety-class text.
- The v3 / v3-safety corpora (they stay on the VPS; only hashes are in the tree).
- A change to the live gate or the demo, unless a signed ADR that does that is in the same merge and Justin intends it.

## Checks before any merge (for Justin or a later operator)

- `git ls-remote` on the branch equals the commit named in the last `[ZIMMER]` comment.
- `gh pr view 35` is still the intended draft (or Justin has marked it ready).
- Diff against `main` reviewed for workflows, `tryairp`, and demo-default paths.
