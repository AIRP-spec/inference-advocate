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
training run. Bounded review, not full-corpus review.

## Taxonomy bind

The corpus and the future pin record `taxonomyVersion` v0.3.0. A taxonomy
content change (definitions, criteria, counter-examples) triggers
regeneration and retraining. A policy-layer change does not. Until retrained,
the evaluator declares itself validated against the older taxonomy version.

## What this is not

Not the LoRA. Not the GGUF. Not template v3 on the live path. Those are
later parts. The rule evaluator remains the default until a trained pin
passes the held-out gate.
