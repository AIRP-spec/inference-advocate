#!/usr/bin/env python3
"""Re-export the gated Q8_0 GGUFs from the archived per-primitive-8056 adapters through the same
code path the 2026-09-14 gate used (train.export_adapter_gguf: bf16 merge, convert_hf_to_gguf f16,
llama-quantize Q8_0) with llama.cpp pinned to the commit that gate recorded. Verifies each GGUF's
SHA-256 against checkpoints.json. A mismatch is a hard stop: no substitute model is used."""
import json, sys, hashlib, subprocess, argparse
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
import train as airp_train  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument('--lora-dir', required=True)
ap.add_argument('--checkpoints-json', required=True)
ap.add_argument('--recipe', required=True)
ap.add_argument('--work', required=True)
ap.add_argument('--steps', default='6420,8560,10700,12840')
ap.add_argument('--llama-commit', default='41abbfd599fbdd3470fcae0a1fb6530ad8403cd7')
a = ap.parse_args()
recipe = json.loads(Path(a.recipe).read_text())
expected = {c['step']: c['ggufSha256'] for c in json.loads(Path(a.checkpoints_json).read_text())['checkpoints']}
work = Path(a.work); work.mkdir(parents=True, exist_ok=True)
llama = work / 'llama.cpp'
head = subprocess.check_output(['git', '-C', str(llama), 'rev-parse', 'HEAD'], text=True).strip()
if head != a.llama_commit:
    sys.exit(f'llama.cpp at {head}, need {a.llama_commit}')
from transformers import AutoTokenizer
base_id = recipe['base']['repoId']
tok = AutoTokenizer.from_pretrained(base_id, trust_remote_code=True)
if tok.pad_token is None:
    tok.pad_token = tok.eos_token
out = {}
for step in [int(s) for s in a.steps.split(',')]:
    adapter = Path(a.lora_dir) / f'checkpoint-{step}'
    merged = work / f'merged-step-{step}'
    gguf = work / f'step-{step}.gguf'
    commit, sha = airp_train.export_adapter_gguf(recipe, base_id, tok, adapter, merged, gguf, work)
    airp_train.rm_if_exists(merged)
    ok = sha == expected[step]
    out[step] = {'gguf': str(gguf), 'sha256': sha, 'expected': expected[step], 'match': ok, 'llamaCpp': commit}
    print(json.dumps({step: out[step]}), flush=True)
(work / 'regen-gguf.json').write_text(json.dumps(out, indent=1))
if not all(v['match'] for v in out.values()):
    sys.exit('GGUF SHA mismatch: stop, do not substitute')
print('all GGUF SHAs match')
