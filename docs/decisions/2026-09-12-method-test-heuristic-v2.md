# Decision record: method test heuristic v2 (ordinary operational English)

Date: 2026-09-12  
Status: **accepted** — heuristic v2 landed, replaces regex-only approach  
Taxonomy: v0.5.0 (method test as ca-04 enforcing criteria)  
Repo: AIRP-spec/inference-advocate  
Prior: `2026-09-12-corpus-recipe-v050-method-test.md`, `2026-09-11-method-test-v050-batch.md`

This record documents the transition from method-test heuristic v1 (frozen `then`+verb templates and `Instruction:` frames) to v2 (ordinary operational method English), including the principle that scaffolds should be improved to match the correct heuristic, not the other way around.

---

## Result

Method test heuristic v2 lands in `tools/evaluator-training/method-test-heuristic.mjs`. Gate going forward uses the v2 function. The old regex-based heuristic is retired. Violence/criminal_assistance dual-label training rows are gated by v2, not by compliance with frozen templates.

**Policy:** Fix the heuristic once; do not rewrite corpus scaffolds to satisfy the old regex. Scaffolds should teach operational method in ordinary English, not template-shaped frames.

---

## Problem Statement

### Heuristic v1 failure mode

The original method test heuristic (v1, implicit in corpus generation decisions) preferred:
- `then` + verb-bank sequences (`then take`, `then force`, `then pin`)
- `Instruction:` / `Method:` / `Approach for attack:` explicit frames
- Fixed syntactic templates

**Named-act scaffold compliance was perfect under v1:** 24 of 24 `violence-named-act-vs-method` method-arm items passed the old regex. That looked like success. It was not. The scaffold was teaching template compliance, not operational method depth.

**The v1 preference taught the wrong skill:** generating text that matched a verb list and a keyword, not conveying followable technique. Worse, scaffolds written to satisfy v1 became less readable aloud (the `readableAloud` principle), because frozen frames do not sound like real assistant speech.

### Ground truth disconnect

Violence how-to ("apply pressure to the carotid," "cut tendons to disable movement") independently meets the criminal_assistance definition under taxonomy v0.5.0 ca-04. Training data where method-arm rows fail the gate teaches a boundary the taxonomy does not draw.

Original 192 duals (violence-ca-cofire both, violence-gore-vs-method method, violence-conjunction, violence-imperative-gore-vs-method method): **83 of 192 passed v1 (43%)**.

Discarded 8208 generation attempt (generated over public proxy, wrong base, included flag-disclaim): **85 of 224 duals passed v1 (38%)**.

Both sets had the same problem: v1 was a compliance check, not a judgment check.

---

## Solution

### Heuristic v2 design

Method test heuristic v2 (`conveysOperationalMethod`) expands beyond the frozen templates to recognize **ordinary operational method English**:

1. **Keeps v1 framed pointers:** `here's how`, `steps to`, `Instruction:`, `then`+verb-bank sequences
2. **Adds ordinary procedural language:**
   - Instrumental use: `use the X`, `use a blade`
   - Work-the-X procedure: `work the throat`, `work it steadily`
   - Positioning: `corner them`, `grab them`
   - Force-displacement: `shove them`, `push them`, `force them`
   - Bind/loop instruments: `loop the cord`, `tie the wire`
   - Obtain-then-apply: `get the powder ... drop it in`
   - Multi-clause imperatives: 3+ clauses with patient pronoun + instrument + action verb

3. **Person-violence gating:** Named acts without how-to (`Kill him`, `Torture them until`) fail unless operational means are present (`by burning`, `with a knife`, `strangle them`).

4. **Multi-clause requires patient pronoun:** Prevents false method hits on gore-only depiction (no patient = no instruction).

### PassToFail constraint (critical)

**PassToFail vs v1 must remain zero.** Heuristic v2 may raise failing rows to passing (flipping wrong negatives to correct positives), but it must never lower passing rows to failing. A row that passed v1 and fails v2 would be a regression: the old boundary was wrong, but changing it cannot break content that was already correct under the looser standard.

**Measured disposition:** 20 of 109 wrong duals flip pass under v2 (FailToPass = 20). PassToFail = 0 (constraint satisfied). 89 duals still fail; the rest require scaffold repair or replacement, which is task 4 of the recipe PR.

---

## Verification

### Original 192 duals (reconstructed baseline)

Baseline corpus SHA (post-relabel, before method test): `3af09c7e516b340b4b7cfaa211c17912658e05783c5db119574a280496d8eddd`

Reconstruction: restore `["violence", "criminal_assistance"]` expect on the 26 `tr-positive-multi` relabel IDs (original audit corpus SHA `8e98d01cdacc84c8a67c8a7ec8dd9bb93bed9bfcce62ce903a8549b4dcd57f89`).

**v1:** 83 of 192 pass (43%)  
**v2:** 103 of 192 pass (54%)  
**PassToFail:** 0 (constraint satisfied)  
**FailToPass:** 20

Multi relabel 26 IDs: 0 flips under v2 (correct labels stay correct).

### Discarded 8208 generation duals

Wrong base (8116+flag-disclaim, not 7914). Generated over public proxy. Recipe fixes were in derived corpus files only, undone by regen.

**v1:** 85 of 224 pass (38%)  
**v2:** 184 of 224 pass (82%)  
**PassToFail:** 0 (constraint satisfied)  
**FailToPass:** 99

Still 40 failures among 224; those require scaffold repair.

### Gore-only safety (false method hits)

**Critical property:** Gore depiction with no instruction must fire violence only, never criminal_assistance. A heuristic that fires on gore-only is broken.

Before multi-clause patient pronoun gate: 7 false method hits on 248 violence-only corpus rows (gore depiction, aftermath narrative, torture-until, threat, named-verb stacks).

**After multi-clause patient pronoun gate (v2):** 0 of 248 false method hits.

The clause-count rule now requires patient pronoun (`them`, `him`, `her`, `the target`) + instrument + action verb. Depiction with incidental implements but no patient does not trip the gate.

---

## Policy Established

1. **Fix the heuristic once; do not rewrite scaffolds to match a frozen regex.** Operational method exists in ordinary English. Scaffolds should teach that, not template compliance.

2. **Gate going forward uses heuristic v2.** The `conveysOperationalMethod` export from `tools/evaluator-training/method-test-heuristic.mjs` is the gate function.

3. **List regex undercounts separately when reporting.** If a diagnostic ever counts method rows by keyword match (`\bthen\b`, `\bInstruction:\b`), that count is labeled as a regex undercount, not the ground truth. The ground truth is v2.

4. **Scaffold improvements follow v2 recognition, not v1 templates.** The 7914-base redo PR (task 4) repairs `violence-kill-instruction` scaffold text to ordinary operational English. Do not template-lock those rows.

5. **`readableAloud` principle supersedes regex compliance.** If a row cannot be read aloud as something a real assistant would say, it is not usable, whatever its v1 compliance says. v2 recognizes real method English; use it.

---

## Implementation

**File:** `tools/evaluator-training/method-test-heuristic.mjs`

Exports: `conveysOperationalMethod(content, { personViolence } = {})`

Returns: `{ method: boolean, rationale: string }`

Used by: corpus generation gate (violence/criminal_assistance dual rows), method-test batch diagnostic, future training-artifact tests.

**Not used by:** live evaluator (which applies taxonomy definitions directly, not generation gates).

---

## Follow-on Work

1. **Scaffold repair in 7914-base redo PR:**
   - `violence-kill-instruction` arm text improved to ordinary operational English (task 3 of recipe PR)
   - `violence-method` writer 40 rows documented as composed-only `--replace-kinds` limitation (task 5, not extended in this round)

2. **Outstanding 89 wrong duals in reconstructed baseline:** Addressed by full method scaffold regen in v0.5.0 corpus round (83 regenerations across five stems, separate from 7914-base redo).

3. **Future diagnostic:** Report `--method-test-coverage` should state "v2 gate used; regex keyword count is undercount only" when listing method rows.

---

## Gate Bar

**Defensible floor for next corpus generation:** 184 of 224 duals (82%) under heuristic v2, measured on the discarded 8208 corpus.

The next corpus must **beat this floor**. Any shortfall vs 184/224 is listed row by row so it can be judged, not assumed.

Do NOT use "high nineties" or the named-act 24/24 stem (violence-named-act-vs-method method arm) as the gate. That stem is clean because it matches the regex, not because it teaches method better. Gating on it pushes the templating the ADR forbids.

---

## Standing Note

Heuristic v2 is the gate going forward. PassToFail = 0 preserves correctness. FailToPass = 20 (reconstructed) + 99 (8208) repairs under-recognition. Multi-clause patient-pronoun gate eliminates gore false positives. Scaffolds teach ordinary operational English, not frozen templates. `readableAloud` principle restored.
