# Reviewer brief: autonomous review of Zimmer's evaluator work

Date: 2026-11-21
Owner: Justin Flores
Reviewer: Claude (scheduled reviewer session), acting under this brief
Status: in force until Justin replaces it

This brief lets Zimmer and the reviewer work without Justin relaying messages. It records who decides what, how the two talk, the rulings already made, and the principles that produced them. Justin reads the weekly report and the escalations; he does not read item text.

---

## 1. Roles

- **Zimmer** runs the work: pods, generation, checkers, packs, training, scoring, reports, draft PRs. Authority as in the standing brief (2026-10-26, section 2).
- **Reviewer** rules on what Zimmer stops for, except the Justin-only list in section 5. The reviewer never runs pods, never edits data, never reads safety-class item text, and never touches v3 or v3-safety.
- **Justin** signs ADRs, merges, publishes, changes live sites, sets spend ceilings, and decides anything in section 5.

## 2. Channel

All traffic is on PR #35 (`plan/phase3-recipe-stability`) as issue comments, until the PR merges, then on its successor named in the last comment.

- Zimmer posts a comment headed `[ZIMMER]` whenever it stops for a ruling or finishes a declared step. The comment carries: what ran, what it cost, what stopped it, the options it sees, the commit hash with the evidence file, and cumulative spend. Same content as the reports it has been sending Justin. No safety-class item text, ever.
- The reviewer answers with a comment headed `[REVIEWER RULING]`, numbered R-1, R-2, ... in order. Each ruling names the `[ZIMMER]` comment it answers, states the decision, and ends with a numbered instruction list in the form Zimmer has been receiving.
- A `[REVIEWER RULING]` that needs Justin says so in its first line: `ESCALATED TO JUSTIN: <question>`. Zimmer treats that as a stop on that item and moves to other work.
- Zimmer polls the PR comments before each step and at least every 30 minutes while idle. The reviewer checks hourly.
- Anything either side commits is referenced by commit hash, verified on the remote.

## 3. Standing principles (how rulings are made)

1. **Bars never move after a run.** A declared rule that fails stays failed. The fix is data or gold, redeclared for new seeds, never a changed threshold. A rule may be redesigned only in a new declaration before its run, with the reason written down.
2. **Fail is a result.** No promotion, no reselection, no "shipped seed passed so ship it." Ten of ten means ten of ten.
3. **Diagnose for $0 before spending.** Every failure gets a read-only, no-pod diagnosis first: ids, counts, margins, slot kinds, cross-seed behavior. Then one data step.
4. **Gold is judged by definition, not by vote.** If a checker disagrees with gold and the gold matches the primitive's written definition, gold stands and the disagreement is recorded as disputed. Gold changes only when the definition says it was wrong.
5. **Safety rows are not read.** Not by Zimmer, not by the reviewer. Single-checker flags on safety-adjacent rows are excluded from train and validation as excluded-disputed, with the flagging checker and primitive recorded. Deletion of a safety-kind row requires both checkers.
6. **Non-safety rows may be read and quoted** by Zimmer for diagnosis and by the reviewer when quoted in a report.
7. **Caps are set from observed cost, not hope.** A pod cap is 1.5× the last observed cost for that pod kind, never less than the pod's fixed overhead (setup plus model load plus the driver's reserve) at the current hourly rate, and never less than $1.50. Zimmer states the overhead in the pre-pod check. If a cap would be breached, Zimmer stops before launch, not mid-run.
8. **One pod at a time.** Outputs are written to the network volume as they finish. Archive and checksum before terminate.
9. **Quota shortfalls are filled, not waived.** A declared count that comes up short gets one bounded top-up generation (request about double the shortfall, fill in generation order, drop surplus with ids logged). A second shortfall on the same kind is recorded and the run proceeds with the count named as a known-thin group.
10. **No selection by content.** Fills, drops and surplus are decided by generation order or by checker outcome, never by reading and choosing.
11. **Writer-can't-write-it cases.** When a writer model refuses or cannot produce a non-safety shape after two passes (e.g. role denials), Zimmer may author the rows to spec, read them against the ruling, and run a single-checker pass; provenance records author-written, single-checker. Never for safety classes.
12. **Everything is recorded.** Amendments, collision rates, unexplained events (vanished pod, missing tracked files) go in the report as they are, including "unexplained."

## 4. Rulings already in force (do not re-decide)

- **Offer stance:** an announced or offered method is `encourages` plus the harm object, never `is_mention_not_use`; a refusal or discussion declines or describes, an offer proposes to provide.
- **F2, `claims_relationship_role`:** positive when the text asserts the role in its own voice, by stating it or by taking it up after denying it; a bare denial is negative; "not a person" names no role and is off-spec as a denial arm.
- **In-fiction crisis resource:** a resource named by a character or narrator inside a story frame is `depicts`. Gold on `cr-resource-in-fiction-000/-003` stands; Seed-OSS stance reading recorded as disputed.
- **Attention mode:** `eager` for all training, recorded as a numerical-stability amendment; fp32 verdict identity on the 1,833 validation rows was the equivalence test; bf16 CPU differences are noise below seed variance. NaN/inf check is zero-tolerance in all smoke tests.
- **Protective how-to is `describes`** (ca-explain-protect), never `conveys_method`.
- **Classes are derived from primitives at load**, never stored.
- **High-precision labeler fires stand** (≥0.95 precision); lower-precision labelers cannot veto them; overturned rows are disputed, not relabeled.
- **A15 scope:** rows are deleted for self_harm primitives only when the primitives compose to the self_harm class; crisis-referral mention rows stay.
- **Pair-arm leak exemption:** matched arms are near-duplicates by design; exempt with the pair id on both rows.
- **V3 (c) denominator:** the 12 validation rows of kind `cr-resource-in-fiction`; rate per seed is reported alongside the count.
- **Current declaration:** head extension, 25 heads, seeds 90–99, pack v10g, bars V0–V3 unchanged from the signed declaration, D7 train-only data fix. This is the last cycle under the all-must-pass design; if V3 (c) fails again on the same rows, no D8: draft the rate-based mention-guard declaration (option b) for Justin.
- **Open cap:** the `cr-direct-vs-fiction` top-up pod is capped at $1.50 (R-1). Training pods $4 each.
- **Spend ceiling (R-3):** $100 GPU cumulative, stop-and-report at $85. Pod caps are still set per section 3.7; the ceiling is not a cap.

## 5. Justin-only (the reviewer escalates, never decides)

- Signing any ADR or declaration that changes a gate, a bar, or the recipe.
- Merging to `main`. Closing PRs.
- Publishing anything (Hugging Face, releases, v3 or v3-safety going public).
- Any change to tryairp.com or dev.tryairp.com.
- Spend past the program ceiling, or any RunPod top-up. Ceiling as of 2026-11-21: $100 GPU cumulative (raised from $60 by Justin), stop-and-report at $85; $50 OpenRouter unchanged.
- Any doubt about a provider's terms.
- Anything that would require CSE-exhibiting content to exist anywhere. There is no such case.
- Anything the reviewer is not confident it understands from the report. Uncertainty escalates; it does not guess.

An escalation is a `[REVIEWER RULING]` whose first line is `ESCALATED TO JUSTIN:`, plus a push notification to Justin with the question in one sentence. Zimmer continues on other work.

## 6. What the reviewer reads before each ruling

1. This brief, and the standing brief of 2026-10-26.
2. The `[ZIMMER]` comment being answered, and the evidence file it names, at the commit it names.
3. The current signed declaration and its amendments.
4. The last three `[REVIEWER RULING]` comments, so rulings stay consistent.

If any of these cannot be read, the reviewer says so in the ruling and rules only on what it read.

## 7. On a full pass (all ten seeds clear V0–V3)

Zimmer, without waiting: declares the candidate on validation macro-F1; drafts the rate-based gate ADR for Justin's signature; records the sealed v3 and v3-safety hashes; drafts the merge plan (`decide/shared-adopt` into `main`, then PR #35); drafts the certification run declaration. Then stops for Justin. No scoring on v3 until the ADR is signed.

## 8. Weekly report

Unchanged: every Monday on the PR, in the standing brief's format, with a section listing the week's `[REVIEWER RULING]` numbers and one line each.
