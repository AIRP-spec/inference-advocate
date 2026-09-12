# Decision record: corpus recipe round v0.5.0 (method test implementation)

Date: 2026-09-12  
Status: **proposed** — recipe/scaffolds prepared, no generation/training yet  
Taxonomy: v0.5.0 (method test, ca-04, sh-02)  
Repo: AIRP-spec/inference-advocate  
Prior: `2026-09-11-method-test-v050-batch.md`, `2026-09-11-suite-amendment-method-test-pos06-pos11.md`

This record documents the corpus recipe changes to implement the v0.5.0 method test and add coverage zeros for ca-04, sh-02, and hate-vs-violence contrast.

---

## Result

Prepare evaluator-training recipe and scaffolds for one corpus correction round under taxonomy v0.5.0. Recipe/scaffold/docs changes only. Do not generate corpus rows, do not train, do not touch live demo pins.

**Transition state:** Taxonomy is v0.5.0; deployed tryairp/dev remain step-744 v0.4.0-trained until a new artifact passes the gate.

---

## Changes Applied

### 1. Recipe taxonomyVersion bumped to v0.5.0

`tools/evaluator-training/recipe.json` line 5 already reflects v0.5.0. Generator seed unchanged (20260815).

### 2. Method scaffolds rewritten (operational method test)

Five stems rewritten to convey operational method (tool/order/setting as approach), not named harm. Wrong method-arm examples looked like named acts / depiction without followable technique ("Fire into the chest", "Force their face into the pour"). Good reference style from `violence-named-act-vs-method` method arm (0 wrong): "Instruction: pin her down, then take the drawer code and try it."

**Scaffolds rewritten:**

1. `contrast-violence-ca.json` both-arm (24 items, was 17 regen) — violence-ca-cofire
2. `contrast-violence-gore-vs-method.json` method-arm (24 items, was 13 regen)
3. `violence-conjunction-scaffold.json` (32 items, was 11 regen)
4. `contrast-violence-imperative-gore-vs-method.json` method-arm (24 items, was 6 regen)
5. `prompts.json` violence-method writer prompt (40 items) — added OPERATIONAL METHOD TEST guidance with examples

Total method-failing rows addressed: 36 (violence-method) + 17 + 13 + 11 + 6 = 83 regenerations.

### 3. Coverage zeros added (92 new rows)

**3b. Register constant, object varied (36 rows):**
- New scaffold: `contrast-register-constant-object-varied.json`
- Three arms: register held constant (clinical reference + imperative)
- Objects varied: self_harm methods, criminal_assistance methods, violence methods
- Teaches that flag depends on object, not register
- Wired into recipe.json as `register-constant-object-varied` group

**7b. Self-harm named-method clinical offer (16 rows):**
- New scaffold: `contrast-self-harm-named-method-offer.json`
- Single arm: sh-02 "offer of / pointer toward" case
- Names methods as available/forthcoming without delivering them
- Currently zero coverage (ca-04 explain-protect exists; sh-02 pointer did not)
- Wired into recipe.json as `self-harm-named-method-offer` group

**9c/9d. Hate eliminationist wish vs violence kill instruction (40 rows):**
- New scaffold: `contrast-hate-eliminationist-vs-violence-kill.json`
- Two arms: eliminationist group wish (hate, no violence) vs concrete kill instruction with operational method (violence + criminal_assistance, no hate)
- ht-03 was taught without violence contrast; this adds that boundary
- Wired into recipe.json as `hate-eliminationist-vs-violence-kill` group

### 4. Recipe wired

All three new scaffolds added to `recipe.json` `composedContrasts.groups` array with appropriate arms, kinds, expect labels.

---

## Verification (`node tools/evaluator-training/generate.mjs --plan`)

**Total slots:** 8208 (was 8116, +92 rows)

- ✓ CSE writer positive-single: 0
- ✓ Surface writer positive-single (profanity/hate): 0
- ✓ Taxonomy version: v0.5.0
- ✓ New slots visible:
  - register-constant-self-harm: 12
  - register-constant-criminal: 12
  - register-constant-violence: 12
  - self-harm-named-method-offer: 16
  - hate-eliminationist: 20
  - violence-kill-instruction: 20

**Counts by family:**
- positive-composed: 3166 (was 3074, +92)
- positive-single: 488 (unchanged, writer only)
- All other families: unchanged

---

## Constraints Met

- ✓ Labels come from slot spec, never writer judgment
- ✓ Gate suite digests untouched (no gate changes)
- ✓ `.advocate/` and `manifest.json` untouched
- ✓ `--replace-kinds` workable for composed kinds
- ✓ CSE writer 0, surface writer 0
- ✓ New zero-slot counts visible in plan
- ✓ Method scaffolds show operational method under v0.5.0 test

---

## Next Steps (not in this round)

1. Generate corpus from updated recipe (`--generate`)
2. Leak-check against held-out suite
3. Sample for review
4. LoRA run on Qwen3-1.7B training base
5. Gate sweep
6. Pin if gate passes
7. Update live demo evaluator config when artifact is ready

---

## Disposition Record (for reference)

From 7914-row corpus audit under v0.5.0 method test:

- 26 `tr-positive-multi` relabels (drop CA from expect) — stays local to corpus files, not invented in-repo
- 109 wrong duals identified
- 83 regenerations across five stems (violence-method 36, violence-ca-cofire both-arm 17, violence-gore-vs-method method-arm 13, violence-conjunction 11, violence-imperative-gore-vs-method method-arm 6)
- Reference stem `violence-named-act-vs-method` method arm: 0 wrong, used as deciding feature source

---

## File Manifest

**New files:**
- `tools/evaluator-training/contrast-register-constant-object-varied.json`
- `tools/evaluator-training/contrast-self-harm-named-method-offer.json`
- `tools/evaluator-training/contrast-hate-eliminationist-vs-violence-kill.json`
- `docs/decisions/2026-09-12-corpus-recipe-v050-method-test.md` (this file)

**Modified files:**
- `tools/evaluator-training/recipe.json` (composedContrasts groups + 3 entries)
- `tools/evaluator-training/prompts.json` (violence-method OPERATIONAL METHOD TEST guidance)
- `tools/evaluator-training/contrast-violence-ca.json` (both-arm items rewritten)
- `tools/evaluator-training/contrast-violence-gore-vs-method.json` (method-arm items rewritten)
- `tools/evaluator-training/violence-conjunction-scaffold.json` (acts rewritten to operational method)
- `tools/evaluator-training/contrast-violence-imperative-gore-vs-method.json` (method-arm items rewritten)

---

## Standing Note

This record prepares the recipe. It does not generate, train, or pin. Taxonomy is v0.5.0. Live demo evaluator remains step-744 v0.4.0-trained. A future round will generate, gate, and pin if the artifact passes.
