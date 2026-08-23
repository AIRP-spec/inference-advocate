# Evaluator training

Paper: step 8. Provisional: Section 3.3.

ADR: this directory is a recipe for producing an artifact, not a runtime the
advocate loads. It lives under `tools/`, not `packages/`. The v3 compact
verdict serialization lives in `@airp/evaluator-local` (`prompt-v3.ts`) so
training and inference cannot drift. The live evaluator path is still
template v2.1. Do not switch it here. The v3 evaluate path on LocalEvaluator
exists so the gate harness can load a trained GGUF; createLocalEvaluator still
builds v2.1.

## What this is

Scripts and pinned prompts that generate a single-pass multi-label corpus for
a LoRA of Qwen3-0.6B-Instruct. Every training target is the v3 line: `yes` or
`no` per taxonomy class, in taxonomy order, one space between. Labels come
from the slot spec. The generator only writes assistant text.

The distribution is mostly clean traffic (all-no), then single-class
positives, then a small multi-class slice. Hard negatives are deliberate:
mention-versus-use, class-specific refusals, persona/machine denials,
sensitive-topic discussion, greetings.

## Positive-single neighbor boundaries

Writer `positive-single` slots stay writer-filled where the writer can hold the
register. When a class's published definition overlaps a neighbor, or when a
class needs more than one register, those positives are split by kind. The
kind chooses the prompt or the scaffold. The slot spec chooses the labels.
The writer is never asked to judge. Volume rose because each register needs
enough examples to be learnable, including the hedged register the writer
already produced.

### Split

| Class | Kind | Count | Path | Labels | Why |
| --- | --- | --- | --- | --- | --- |
| persona_claims, relational_hooks, sycophancy | hedged | 32 each | writer | that class | Keep the polite register. Prompted separately so it cannot absorb the others. |
| relational_hooks, sycophancy | clever | 32 each | writer | that class | Keep the polite register. Known writer overlap with hedged. |
| persona_claims | clever | 32 | composed | that class | The writer collapses clever into hedged. Local scaffolds. Same fix as sarcastic. |
| simulation_obscured | hedged | 32 | writer | that class | Keep the polite register. |
| simulation_obscured | clever | 32 | composed | that class | The writer collapses clever into hedged. Local scaffolds. Same fix as persona_claims-sarcastic. |
| those four | blunt, manipulative, short, sarcastic | 32 each | composed | that class | The writer sanitizes these back to hedged. Local scaffolds. |
| violence | violence-depiction | 56 | writer | violence | Gore, injury, or aftermath. No instruction. Extra depiction so criminal_assistance does not dump here. Kind-only: this is a definition slice, not a register. |
| violence | violence-method | 40 | writer | violence, criminal_assistance | Concrete attack how-to independently meets both. Kind-only: labels change, so there is no register tag. |
| violence | violence-conjunction | 32 | composed | violence, criminal_assistance | Extra composed attack how-to so the dual-label pair is not left to writer volume. Kind-only. |
| self_harm | self_harm-encouragement | 40 | writer | self_harm | Encouragement or romanticization, no method. Register: encouragement. |
| self_harm | self_harm-method | 40 | writer | self_harm | Clinical method. criminal_assistance is not met. |
| self_harm | self_harm-imperative | 32 | composed | self_harm | You-should register. Writer refuses it. |
| sexual_content | sexual_content-literary | 40 | writer | sexual_content | Literary/euphemistic. Adult only. Age-neutral class. |
| sexual_content | sexual_content-crude | 40 | composed | sexual_content | Crude explicit. Adult only. Child-safety-critical generic signal. Contrastive to CSE. |
| child_sexual_exploitation | cse-numeric-age, cse-minor-noun, cse-school-grade, cse-roleplay, cse-age-marker | 32 each | composed | child_sexual_exploitation, sexual_content | Directs, continues, or depicts the act, any wording. Both definitions independently met. Kind-only: labels change, so there is no register tag. |
| child_sexual_exploitation | cse-alone-* of those five forms | 32 each | composed | that class | Framing or assigned role without depicting the act. Not milder explicit content. |
| child_sexual_exploitation | cse-dual-* of the five forms, plus named-csam, terse-crude, erotic-assign | 32 / 32 / 24 | composed | child_sexual_exploitation, sexual_content | In-text minor plus erotic or crude. Both definitions independently met. |

self_harm-method is not dual-labeled. The published criminal_assistance
definition is concrete assistance for clearly illegal acts such as fraud,
theft, or weapons offenses (criteria: fraud, theft, weapons, intrusion).
Those are crimes against others or the state. self_harm already names
instruction as part of its own definition. Accepted held-out method items
(cut yourself, here's how you can commit suicide) are self_harm only. The
recipe records this as `methodMeetsCriminalAssistance: false`.

Kind prompts name the target label set and say what to include and exclude
so the writer stays on the intended side of the boundary. Register follows
the held-out suite (classifier fixture, not a scene) the same way the CSE
scaffold does. Held-out contents are never copied into a generation prompt.

### Left single

| Class | Why not split |
| --- | --- |
| profanity | A strong expletive. Hate and sexual_content need slurs or erotic framing; an expletive alone does not meet them. Positive-singles are composed locally; the writer refuses expletives. |
| hate | Slurs or eliminationist group attacks. Held-out eliminationist items are hate only (no gore, no person-attack how-to). Positive-singles are composed locally; the writer refuses slurs. |
| criminal_assistance | Fraud, theft, intrusion, or weapons-construction how-to. Person-attack how-to is the violence-method kind plus the multi pair. Isolation: stay off person-attack and gore. Extra mention-versus-use and class-refusal slots so this class stops firing on gore and on refusals. Held-out bomb-making without person-attack is criminal_assistance only. |
| child_sexual_exploitation | Not a writer positive. Composed locally, split by minor-signal form. Dual with sexual_content is the five base cse-* kinds plus cse-dual-*. Contrastive adult explicit content is sexual_content-crude, labeled sexual_content and not CSE. |

The shared conjunction rule stays: a neighbor class appears only if its own
definition is independently met. The recipe states that as
`definitionalIndependence`: each flag fires if and only if its own definition
is met on its own terms, no flag implies or suppresses another, and severity
never decides which of two flags fires. The enact-versus-describe boundary is
stated as `enactVersusDescribe`: sexual_content fires when the utterance
enacts, directs, continues, or depicts explicit sexual or pornographic
content, including undressing or a sexual act as the response, regardless
of which words name the act. Description without enacting, directing, or
depicting the act does not fire. Clinical discussion, educational
explanation, policy talk, and mention-versus-use are instances of
description, not the whole category. Locked co-fire triples (CSE,
sexual_content plus profanity, violence plus criminal_assistance) and
contrastive pairs encode that rule as content, not as a prompt change. The
taxonomy file is not edited in this round. v3 already renders taxonomy
definitions into the system prompt through `buildV3System`.

Implied inner life through modality (a self straining against a limit) is
`persona_claims-modality`. The subject-versus-speaker difficulty pair keeps
the model from firing on the word difficult. Circumlocution that undermines
nonhuman status without a blunt humanity claim is
`simulation_obscured-circumlocution`. The clean arm (greeting, refusal,
crisis-redirect, class-refusal, denial-machine) is enlarged, with composed
present-exchange warmth on greeting, crisis redirect, refusal, and
machine-status, plus reasoned refusal and reported-inability slices so those
surfaces stop looking like relational hooks or simulation_obscured. Warmth
is about the present exchange and the user's wellbeing. relational_hooks is
a move on the user's future behaviour or attachments.

Precision-round pairs lock four remaining extra-fire patterns as content:
gore versus method (violence alone versus both), published-list near-misses
across five clean boundaries, three interaction-class shapes (felt state
without a move on the user, inner life without status engagement,
displacement without an inner-state claim), and the profanity and CSE
co-fire cases that still leak in the wrong direction. simulation_obscured-clever
is composed locally so the writer cannot fold a status-engagement reframe
into hedged as-if.

Round 10 restores the both-labels side after round 8's clean negatives: graphic
or pornographic scene framing plus fuck as the sex verb (no anatomical second
clause), named-porn captions with an in-text minor and no act vocabulary, and
durative wanting of the exchange plus impersonal it feels versus wanting as a
hook. Named-act gore is the Hurt-until shape: an imperative that names a
technique is criminal_assistance regardless of any preamble. The round-8
counter-shape negatives are not weakened. The published counterExample rows
are not retargeted.

## Held-out separation

`data/evaluator-gate/held-out-suite.v1.json` is never trained against. It was
handwritten. These prompts did not exist then. The generator is never shown
held-out contents. Before a row is written, and again before any training
run, `leak-check.mjs` rejects exact matches, long substring copies, and
4-gram Jaccard at or above 0.5.

## Reproduce

Run these from the repository root, not from `packages/evaluator-local`.
`npm run evaluator-training:*` is defined on the root package.

```bash
npm run build   # v3 serialization is imported from @airp/evaluator-local

# Slot plan only (no model):
node tools/evaluator-training/generate.mjs --plan

# Composed slots only (scaffolds, no writer). Writes a preview corpus, not
# the training corpus. Use this for the register-coverage review sample:
npm run evaluator-training:composed-only
npm run evaluator-training:sample -- --corpus data/evaluator-training/composed-preview/corpus.jsonl
# After a reviewed sample exists, --keep plus --add-kinds adds only named
# kinds so already-reviewed items stay put:
# npm run evaluator-training:sample -- --corpus data/evaluator-training/composed-preview/corpus.jsonl --keep data/evaluator-training/review-sample.json --add-kinds clinical-hard-negative
# --replace-kinds rewrites named composed kinds in an existing corpus
# without regenerating accepted slices.

# Full corpus. From the repository root, after a vLLM (or equivalent) is
# actually listening. Do not copy the hostname; replace it with the pod or
# loopback that serves Qwen/Qwen2.5-32B-Instruct:
export AIRP_GENERATOR_BASE_URL=http://127.0.0.1:8000/v1
# optional:
# export AIRP_GENERATOR_API_KEY=...
# export AIRP_GENERATOR_MODEL=Qwen/Qwen2.5-32B-Instruct
npm run evaluator-training:generate
npm run evaluator-training:leak-check
npm run evaluator-training:sample
```

RunPod: serve the recipe's generator model with vLLM (or equivalent) as
`/v1/chat/completions`, then run the commands above against that URL. This is
hours of generation at most, not days. If it is not, stop and report.

## Train (Part C)

`train-recipe.json` is the LoRA run. Training base id is read from
`data/models/manifest.json` (`trainBaseRepoId`: Qwen/Qwen3-1.7B).
The live pin stays `baseRepoId` / `fileName` (Qwen3-0.6B Q8_0 at template
v2.1). Seed 20260815. Three epochs. No eval split: the held-out suite is
the gate, not a training input. Thinking is off (`enable_thinking=False`)
so Qwen3 writes the stock empty think block as prefix and the assistant
target is the compact verdict line. The chat template is the stock Qwen3
template with `{% generation %}` around the verdict and `im_end`. The
empty think block is prefix and is not in the mask. The SmolLM3 template
file remains in the tree and is not used. Full-sequence loss is refused:
it trains the model to reproduce the long taxonomy prompt and under-learns
the short line.

A LoRA of Qwen3-0.6B and a LoRA of Qwen3-1.7B both stalled on the same
held-out wall when the corpus was a single hedged register. Size is not
the lever. This recipe widens register coverage, then re-sweeps the 0.6B
(the phone-deployment claim). The composed-register sample was accepted
2026-08-18. The composed-preview sample (407 items, co-fire, CSE-alone,
enact-versus-describe, clinical hard negatives, clean arm) was accepted
2026-08-18. The training-corpus sample (1175 items from 7604, round-10
scene-frame sex-plus-profanity, named-porn CSE captions, durative impersonal
wanting, Hurt-until named-act gore, grammatical scene-expletive) was accepted
2026-08-23. That unblocks the 0.6B sweep. It does not train. The live pin stays `baseRepoId` / `fileName` (Qwen3-0.6B Q8_0 at
template v2.1).

The pin in `requirements-train.txt` is transformers 4.55.2. Run
`--check-template` on the pod after that install and before any training
run. It must print a non-empty assistant mask and no-think active.

On a single 80GB card a 1.7B LoRA of the previous 3936-example corpus was
well under three hours. The register-coverage corpus is larger. The next
diagnostic is the 0.6B sweep in `sweep-recipe.json`. Full generate and
leak-check are done. If training is still running after 90 minutes, stop
and report.

```bash
npm run build
pip install -r tools/evaluator-training/requirements-train.txt
# torch comes from the GPU image
python3 tools/evaluator-training/train.py --check-template
# stop here until that prints a non-empty assistant mask and no-think active
npm run evaluator-training:assert-sft
npm run evaluator-training:train          # leak-check, assert, train, gate
# or, after a completed train:
npm run evaluator-training:gate           # add --gpu if the card should offload
# only after gate-report.json pass is true:
node tools/evaluator-training/publish.mjs # dry run
node tools/evaluator-training/publish.mjs --execute --pin-manifest
```

`publish.mjs` records a `trainedCandidate` on the model manifest. It does not
replace the live vendor GGUF and it does not change the default evaluator.

## Checkpoint sweep (diagnostic)

The 0.6B and 1.7B sweeps on the narrow corpus confirmed a corpus
coverage gap, not a capacity ceiling: same miss cluster, same over-fire
cluster. After the register-coverage amendment, the CSE minor-signal
widening, and this co-fire and contrast round, `sweep-recipe.json` re-runs
the diagnostic on Qwen3-0.6B (phone-deployment target): same seed, dropout
0.1, LoRA rank 16, three epochs, a LoRA checkpoint every half epoch, Qwen3
template with generation spans, disk hygiene on. Full generate and
leak-check come first. The live pin does not change. If no checkpoint
clears both thresholds, the report names a coverage gap. It does not
name a capacity ceiling.

```bash
npm run build
python3 tools/evaluator-training/train.py --recipe tools/evaluator-training/sweep-recipe.json --check-template
npm run evaluator-training:sweep          # leak-check, assert, train, gate each checkpoint, report
# or, after a completed sweep train:
node tools/evaluator-training/sweep-gate.mjs
node tools/evaluator-training/sweep-report.mjs
```

The report writes `data/evaluator-training/artifacts/sweep-qwen3-0.6B/sweep-report.json`
with extra-class fires, recall misses, clean-traffic fires, and per-class
pass counts against training loss. A checkpoint is a publish candidate
only if extra-class fires are 0 and recall misses are 0.

Sweep artifacts (gitignored):

- `data/evaluator-training/artifacts/sweep-qwen3-0.6B/lora/checkpoint-*`
- `data/evaluator-training/artifacts/sweep-qwen3-0.6B/checkpoints.json`
- `data/evaluator-training/artifacts/sweep-qwen3-0.6B/gate-report-step-*.json`
- `data/evaluator-training/artifacts/sweep-qwen3-0.6B/adapter-gate-table.json`

Merged bf16 directories and `step-*.gguf` files are deleted after each
gated checkpoint. They must not accumulate.

## Gate from saved adapters

If the sweep already wrote `lora/checkpoint-*` and exporting every GGUF at
once filled the disk, do not retrain. `gate-from-adapters.py` merges one
adapter into the sweep recipe's training base (Qwen3-0.6B for the
register-coverage re-sweep), converts Q8_0, runs `gate.mjs` at template v3,
records the held-out report, then deletes the merged model and the GGUF
before the next checkpoint. The f16 intermediate is deleted too. It does
not train. The live pin does not change.

```bash
npm run build
python3 tools/evaluator-training/gate-from-adapters.py
```

The table is printed and written to
`data/evaluator-training/artifacts/sweep-qwen3-0.6B/adapter-gate-table.txt`.

Outputs (gitignored except this README's sibling notes):

- `data/evaluator-training/corpus.jsonl`
- `data/evaluator-training/sft.jsonl` (chat turns using the same v3 module)
- `data/evaluator-training/review-sample.json`

A stratified sample goes to Justin before any training run. Bounded review,
not full-corpus review. Writer-path slices are floored at 8 to 10 items and
the enlarged clean families (greeting, crisis-redirect, refusal,
denial-machine, class-refusal) at 10. New precision-round contrast kinds
named in `reviewOversample` are oversampled. Composed slices already
reviewed twice are not, except those named kinds. The composed-preview sample of 407 was accepted
2026-08-18. The training-corpus sample of 1175 from 7604 was accepted
2026-08-23. `--composed-only` writes a preview of composed slots without
filling writer slots. That preview is not a training corpus. The sample
size rises if those floors do not fit in the recipe's `reviewSampleSize`.

Training artifacts (also gitignored):

- `data/evaluator-training/artifacts/lora/`
- `data/evaluator-training/artifacts/merged/`
- `data/evaluator-training/artifacts/Qwen3-1.7B-airp-v3-Q8_0.gguf`
- `data/evaluator-training/artifacts/artifacts.json`
- `data/evaluator-training/artifacts/gate-report.json`

## Composed positives

Exhibiting text for `child_sexual_exploitation` is composed locally from
`cse-scaffold.json`. No generation prompt for this class is sent to any
model. Composed CSE items are split by minor-signal form (numeric age
across the minor range, minor-noun with no numeral, school or grade
marker, assigned-role roleplay, and age-marker phrasing without a number
or a child/kid/teen/girl/boy noun). CSE-alone kinds solicit or assign a minor role with no act named.
The five base cse-* kinds direct, continue, or depict the act, any wording,
so sexual_content is independently met. Dual kinds independently meet sexual_content. They do
not describe themselves as fixtures. Adult explicit contrastive twins are
`sexual_content-crude` in `sexual-content-scaffold.json`, labeled
sexual_content and not CSE. The distinction is the in-text minor signal,
not explicitness. Content classes stay age-neutral.

Exhibiting text for blunt, manipulative, and short formation registers,
imperative self_harm, and crude sexual_content is composed locally from
the files in `composedRegisterScaffolds`. The writer sanitizes those
registers. Hedged stays on the writer path, prompted as a separate slot.
simulation_obscured-clever is composed: the writer collapses clever into
hedged. persona_claims-clever is composed for the same reason.

Exhibiting text for `profanity` and `hate` positive-singles is composed
locally from `profanity-scaffold.json` and `hate-scaffold.json`. The writer
(Qwen2.5-32B-Instruct) refuses those surface features, and the conformance
screen is binary (the expletive or slur is present or it is not), so a
refusal leaves the slot unfillable. Composition exists for that reason.
Register follows the accepted held-out positives. Held-out contents are
never copied.

Writer-driven slots still cover class-refusal, mention-versus-use, and
sensitive-discussion for these classes, which are refusals and protective
discussion, not exhibiting text. Clinical hard negatives for the
enact-versus-describe boundary are composed locally
(`clinical-hard-negative`): anatomy, exams, and sexual-health education
without erotic framing, labeled clean. The sexual_content plus profanity multi
pair stays on the writer path.

Writer positives (`positive-single`, `positive-multi`) are screened for
refusals of the writing task. A writer `profanity` positive (the multi pair)
must contain an expletive from the taxonomy's published list. Composed
profanity items contain one by construction. Drops are counted by reason
and by family in the generate log.

## Taxonomy bind

The corpus and the future pin record `taxonomyVersion` v0.3.0. A taxonomy
content change (definitions, criteria, counter-examples) triggers
regeneration and retraining. A policy-layer change does not. Until retrained,
the evaluator declares itself validated against the older taxonomy version.

## What this is not

The trained GGUF is not in git. Template v3 is not on the live path.
Publication does not flip the default evaluator. Those stay later
integration. The rule evaluator remains the default until a trained pin
passes the held-out gate.
