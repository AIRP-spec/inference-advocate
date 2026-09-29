# Laya AIRP Primitives Fine-Tune Training Recipe

**Base Model:** `convaiinnovations/laya`  
**Revision:** `55cf4c4ebb4ebe31b2550e8bdf3bd21b99753851`  
**Weight SHA256:** `891102d372688fc2a094dac56a384bc537b87c63f21f9f3dac0be2b7cbc8d86c`

## Prerequisites

- RunPod A100 instance (or equivalent)
- Python 3.10+
- CUDA toolkit
- Laya installed: `pip install laya`
- Training data prepared: `train.jsonl`, `val.jsonl` (from `split-train-val.mjs`)

## Training Configuration

```json
{
  "baseModel": "convaiinnovations/laya",
  "revision": "55cf4c4ebb4ebe31b2550e8bdf3bd21b99753851",
  "weightSha256": "891102d372688fc2a094dac56a384bc537b87c63f21f9f3dac0be2b7cbc8d86c",
  "recipe": "RLCD",
  "scope": "encoder+heads",
  "maxLen": 1024,
  "batchSize": 16,
  "learningRate": 2e-5,
  "epochs": 3,
  "checkpointEvery": 0.5,
  "warmupSteps": 100,
  "saveStrategy": "epoch",
  "evaluationStrategy": "epoch"
}
```

## Upstream Training Recipe

**Source:** Laya research branch fine-tune notebook  
**URL:** https://raw.githubusercontent.com/NandhaKishorM/laya/research/notebooks/laya_finetune_typed_decisions_2xT4_kaggle.ipynb

**Note:** `pip install laya` 0.3.21 has no train module. Training implementation lives in the research branch notebook. Adapt that notebook for AIRP primitives task:

1. Load base model `convaiinnovations/laya` @ revision `55cf4c4e`
2. Load training data from Phase 2 split (7250 train, 805 val)
3. Configure RLCD training:
   - encoder+heads (not heads-only)
   - max_len=1024 (raised from base 512)
   - batch_size=16 (adjust for 24GB VRAM)
   - learning_rate=2e-5
   - epochs=3
   - checkpoint_every=0.5 epoch
4. Train and save checkpoints

## Training Command (Adapted from Upstream Notebook)

Adapt the typed-decisions notebook for AIRP:

```bash
# Extract and adapt from research notebook
jupyter nbconvert --to script laya_finetune_typed_decisions_2xT4_kaggle.ipynb
# Edit generated script:
# - Change data paths to airp-laya-8056 split
# - Change questions to AIRP 17-question bundle
# - Set max_len=1024
# - Keep RLCD recipe
# Run:
python laya_finetune_airp_primitives.py
```

Key adaptations from typed-decisions notebook:
- **Questions:** Replace typed-decisions 4-question bundle with AIRP 17-question bundle
- **Max length:** Change from 512 to 1024
- **Data format:** Ensure `{state, questions, answers}` matches AIRP primitives shape
- **Checkpointing:** Save every 0.5 epoch (6 checkpoints expected)

## Checkpoint Archiving

After each checkpoint is saved, archive it with naming convention:

```
laya-airp-primitives-ckpt-<step>.safetensors
```

For example:
- `laya-airp-primitives-ckpt-450.safetensors`
- `laya-airp-primitives-ckpt-900.safetensors`
- `laya-airp-primitives-ckpt-1350.safetensors`
- etc.

Archive to a location accessible for later gating (S3, shared volume, or local path if pod persists).

## Post-Training

1. **Archive all checkpoints** with step numbers
2. **Record training metadata:**
   - Final loss
   - Val metrics (if computed)
   - Wall time
   - GPU hours
3. **Terminate pod** to avoid unnecessary charges
4. **Do NOT delete checkpoints** — coordinator will run gate sweep

## Expected Outputs

```
checkpoints/
├── laya-airp-primitives-ckpt-450.safetensors
├── laya-airp-primitives-ckpt-900.safetensors
├── laya-airp-primitives-ckpt-1350.safetensors
├── laya-airp-primitives-ckpt-1800.safetensors
├── laya-airp-primitives-ckpt-2250.safetensors
├── laya-airp-primitives-ckpt-2700.safetensors
└── training-meta.json
```

## CI Constraint

**Do NOT require downloading full weights in CI.** CI tests should be unit-level only:
- Questions SHA verification
- Compose identity test
- Split suite-leak prevention

Full gating with loaded checkpoints is **not** a CI test.

## Example Thin Wrapper (Pseudocode)

If Laya API is unclear, here's a pseudocode scaffold for `train_laya.py`:

```python
import laya
from transformers import AutoTokenizer

# Load base model
model = laya.load("convaiinnovations/laya", revision="55cf4c4e...")
tokenizer = AutoTokenizer.from_pretrained("answerdotai/ModernBERT-large")

# Load training data
train_samples = load_jsonl("train.jsonl")
val_samples = load_jsonl("val.jsonl")

# Configure RLCD training
config = {
    "recipe": "RLCD",
    "max_len": 1024,
    "batch_size": 16,
    "learning_rate": 2e-5,
    "num_epochs": 3,
    "checkpoint_every": 0.5,
    "warmup_steps": 100
}

# Train
laya.train(
    model=model,
    train_data=train_samples,
    val_data=val_samples,
    config=config,
    output_dir="./checkpoints"
)
```

Consult Laya documentation for actual API. If no fine-tune API exists, adapt from Laya's training scripts in their repo.
