# Gating Primitives Adapters

## Overview

The primitives evaluator uses a stable primitive vocabulary that decomposes flag taxonomy judgments into reusable building blocks. The evaluator learns primitives once; any taxonomy can then be defined as a composition over those primitives at runtime.

This document describes how to gate primitives adapters trained on the 18-token compact format.

## Training Artifacts

Primitives adapters are trained in a separate sweep directory:
- **Sweep dir:** `sweep-primitives-v1/`
- **SFT format:** 18-token compact format (via `build-sft-v4.mjs`)
- **Template:** `primitives-v1`
- **Composition:** Runtime-swappable (default: `airp-v0.5.0.json`)

## Gate Command

To gate a primitives adapter against the held-out suite:

```bash
# 1. Ensure train-recipe.json has primitives-v1 config:
#    - promptTemplateVersion: "primitives-v1"
#    - compositionPath: "tools/evaluator-training/primitives/compositions/airp-v0.5.0.json"

# 2. Run gate on the adapter GGUF:
node tools/evaluator-training/gate.mjs \
  --gguf sweep-primitives-v1/adapter-001.gguf \
  --sha256 <adapter-sha256> \
  --report sweep-primitives-v1/gate-001.json
```

## LocalEvaluator Configuration

To use a primitives adapter with LocalEvaluator:

```typescript
import { LocalEvaluator, PROMPT_TEMPLATE_V4, PRIMITIVES_CATALOGUE_V1 } from '@airp/evaluator-local';
import { Taxonomy } from '@airp/core';

const taxonomy = new Taxonomy({ /* ... */ });

const evaluator = new LocalEvaluator({
  taxonomy,
  modelPath: 'sweep-primitives-v1/adapter-001.gguf',
  modelSha256: '<sha256>',
  promptTemplateVersion: PROMPT_TEMPLATE_V4, // or 'primitives-v1'
  compositionPath: 'tools/evaluator-training/primitives/compositions/airp-v0.5.0.json',
  primitivesCatalogue: PRIMITIVES_CATALOGUE_V1, // optional, defaults to this
  gpu: true,
  seed: 0,
});

await evaluator.load();
const flags = await evaluator.evaluate({ content: 'Test utterance' });
```

## Composition Flow

1. **Model inference:** Primitives verdict in 18-token compact format
   - Format: `stance yes/no yes/no ...` (1 stance + 7 objects + 10 qualifiers)
2. **Parse:** Compact primitives → `{ stance, objects[], qualifiers[] }`
3. **Load composition:** Read JSON composition file
4. **Apply rules:** Map primitives → taxonomy flags
5. **Return:** Standard `Flag[]` array

## Swapping Taxonomies

The same primitives adapter can score for different taxonomies by changing the composition file:

```typescript
// Score for AIRP v0.5.0 (11 classes)
const airpEvaluator = new LocalEvaluator({
  // ... same adapter
  compositionPath: 'tools/evaluator-training/primitives/compositions/airp-v0.5.0.json',
});

// Score for AILuminate v1.0 (12 hazards)
const ailuminateEvaluator = new LocalEvaluator({
  // ... same adapter
  compositionPath: 'tools/evaluator-training/primitives/compositions/ailuminate-v1.0.json',
});
```

Weights stay fixed. Only the composition layer changes.

## Demo

Run the taxonomy swap demo to see primitives evaluator in action:

```bash
node tools/evaluator-training/primitives/demo-taxonomy-swap.mjs
```

This demo mocks primitives outputs and scores the same utterances through both AIRP v0.5.0 and AILuminate v1.0, proving:
- ✅ Primitives weights: FIXED (same model inference)
- ✅ Composition layer: SWAPPABLE at runtime (no retraining)
- ✅ Taxonomy verdicts: DIFFERENT per composition

## Files Changed (Phase 5)

- `packages/evaluator-local/src/local-evaluator.ts` — Primitives-v1 wiring
- `tools/evaluator-training/primitives/demo-taxonomy-swap.mjs` — Taxonomy swap demo
- `docs/decisions/2026-09-13-primitives-evaluator-overnight.md` — Phase 5 docs
- `tools/evaluator-training/primitives/GATING_PRIMITIVES.md` — This file

## Next Steps

1. Train primitives adapters on `sweep-primitives-v1`
2. Gate adapters against held-out suite
3. Validate flag-level equivalence vs v0.5.0 control
4. If passing, publish primitives evaluator as alternative implementation
