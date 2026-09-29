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

## Training Command (Scaffold)

**Note:** This is a scaffold. Adapt to actual Laya fine-tune API once upstream documentation is consulted.

```bash
python train_laya.py \
  --base_model convaiinnovations/laya \
  --revision 55cf4c4ebb4ebe31b2550e8bdf3bd21b99753851 \
  --train_file train.jsonl \
  --val_file val.jsonl \
  --questions_file questions.json \
  --output_dir ./checkpoints \
  --recipe RLCD \
  --max_len 1024 \
  --batch_size 16 \
  --learning_rate 2e-5 \
  --num_epochs 3 \
  --checkpoint_every 0.5 \
  --warmup_steps 100 \
  --save_strategy epoch \
  --evaluation_strategy epoch
```

If the Laya package does not expose a CLI or simple API for fine-tuning, create a thin wrapper script `train_laya.py` that:
1. Loads the base model from HuggingFace Hub (with revision pin)
2. Verifies weight SHA256 (optional but recommended)
3. Loads training data (samples must be in Laya's expected format: `{state, questions, answers}`)
4. Configures RLCD training
5. Trains encoder+heads at max_len=1024
6. Saves checkpoints every 0.5 epoch

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
