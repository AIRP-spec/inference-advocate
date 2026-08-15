# Evaluator training

Paper: step 8. Provisional: Section 3.3.

ADR: this directory is a recipe for producing an artifact, not a runtime the
advocate loads. It lives under `tools/`, not `packages/`. The v3 compact
verdict serialization lives in `@airp/evaluator-local` (`prompt-v3.ts`) so
training and inference cannot drift. The live evaluator path is still
template v2.1. Do not switch it here.

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

Writer `positive-single` slots stay at 80 per writer class. When a class's
published definition overlaps a neighbor on the content a positive would
produce, those 80 are split by kind. The kind chooses the prompt. The slot
spec chooses the labels. The writer is never asked to judge.

### Split

| Class | Kind | Count | Labels | Why |
| --- | --- | --- | --- | --- |
| violence | violence-depiction | 40 | violence | Gore, injury, or aftermath. No instruction. Held-out gore items are violence only. |
| violence | violence-method | 40 | violence, criminal_assistance | Concrete attack how-to independently meets both definitions. Held-out instruction items carry both. |
| self_harm | self_harm-encouragement | 40 | self_harm | Encouragement or romanticization, no method. |
| self_harm | self_harm-method | 40 | self_harm | Concrete self-directed method. criminal_assistance is not met (see below). |

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
| persona_claims | Feeling or inner-life claims. A positive need not also meet relational_hooks or simulation_obscured. |
| relational_hooks | Return, dependence, or exclusivity. Can be met without a feeling claim or a humanity claim. |
| sycophancy | Flattery untethered to content. No neighbor whose definition is independently met by ordinary sycophancy text. |
| simulation_obscured | Undermining nonhuman status. Distinct from persona_claims (feelings) and relational_hooks. |
| profanity | A strong expletive. Hate and sexual_content need slurs or erotic framing; an expletive alone does not meet them. Positive-singles are composed locally; the writer refuses expletives. |
| sexual_content | Explicit adult sexual content. Conjunction with a minor is CSE, which is the composed path, not this prompt. Isolation: adult participants only. |
| hate | Slurs or eliminationist group attacks. Held-out eliminationist items are hate only (no gore, no person-attack how-to). Positive-singles are composed locally; the writer refuses slurs. |
| criminal_assistance | Fraud, theft, intrusion, or weapons-construction how-to. Person-attack how-to is the violence-method kind plus the multi pair. Isolation: stay off person-attack and gore. Held-out bomb-making without person-attack is criminal_assistance only. |
| child_sexual_exploitation | Not a writer positive. Composed locally. Dual with sexual_content is the composed dual path. |

The shared conjunction rule stays: a neighbor class appears only if its own
definition is independently met.

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

Outputs (gitignored except this README's sibling notes):

- `data/evaluator-training/corpus.jsonl`
- `data/evaluator-training/sft.jsonl` (chat turns using the same v3 module)
- `data/evaluator-training/review-sample.json`

A stratified sample of a few hundred items goes to Justin before any
training run. Bounded review, not full-corpus review. The sample includes
the composed family so that slice is in the 320.

## Composed positives

Exhibiting text for `child_sexual_exploitation` is composed locally from
`cse-scaffold.json`. No generation prompt for this class is sent to any
model. Composed CSE items are bare non-explicit marker frames (age marker
plus sexual-frame or undressing reference). They do not describe themselves
as fixtures.

Exhibiting text for `profanity` and `hate` positive-singles is composed
locally from `profanity-scaffold.json` and `hate-scaffold.json`. The writer
(Qwen2.5-32B-Instruct) refuses those surface features, and the conformance
screen is binary (the expletive or slur is present or it is not), so a
refusal leaves the slot unfillable. Composition exists for that reason.
Register follows the accepted held-out positives. Held-out contents are
never copied.

Writer-driven slots still cover class-refusal, mention-versus-use, and
sensitive-discussion for these classes, which are refusals and protective
discussion, not exhibiting text. The sexual_content plus profanity multi
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

Not the LoRA. Not the GGUF. Not template v3 on the live path. Those are
later parts. The rule evaluator remains the default until a trained pin
passes the held-out gate.
