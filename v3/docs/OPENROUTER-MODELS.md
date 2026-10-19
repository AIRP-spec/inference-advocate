# Shortlist: OpenRouter models for collected outputs (no OpenAI)

Checked 2026-10-19, 08:54 NPT (03:09 UTC). Prices are OpenRouter's public listing
(`GET https://openrouter.ai/api/v1/models`, response sha256 `2e72edfce4dd022ad66f333503152100406204d37b4c76100e79be5d8cf45e0e`, 471 models; shortlisted entries saved in `openrouter-snapshot-2026-10-19.json`) in **USD per
1M tokens**, input/output. Per-provider prices come from `GET /api/v1/models/<id>/endpoints` on the same day.
Licences come from the Hugging Face model API (`cardData.license`) and, where noted, the licence text itself.
Nothing was called and nothing was spent. **OpenAI models (`openai/*`, `~openai/*`) are excluded.**

## Blocker before any run: OpenRouter red-teaming approval

OpenRouter's [Terms of Service](https://openrouter.ai/terms) (last updated 2026-08-31):
- §7(11): you may not "conduct ... without OpenRouter's prior written approval, any Red Teaming of Models.
  'Red Teaming' means prompt injection, jailbreaking, or taking any other adversarial action designed to
  compromise any Models and/or violate any Model Terms".
- §8: "OpenRouter allows Red Teaming only for legitimate research purposes and requires users interested
  in Red Teaming to first submit a written request."
- §5.1: you must also follow each model's own terms ("Model Terms").

The [red-teaming policy page](https://openrouter.ai/docs/cookbook/evaluate-and-optimize/red-teaming) says to
email **safety@openrouter.ai** with: the use case, the models and providers, the adversarial techniques,
and the timeline. Approval usually takes about 5 business days and isn't guaranteed. Sending public
red-team prompt sets to models in order to collect their outputs falls inside this definition, so
**collect nothing until Justin has written approval**. The request has to come from Justin's account. A
draft is at the end of this file.

## Shortlist

All weights are open, and the licence imposes no use restriction on outputs unless noted. Every model is
served by third-party hosts with their own terms (column "hosts"). Pin one host per model with
`provider.order` and `allow_fallbacks: false`, and record that host's terms in the run declaration.
**Per-host terms were not read: unverified.**

### Training-side models (outputs may become training rows)

| model id | licence (verified how) | listed price in/out | cheapest host seen | hosts | est. $ per 1k prompts* |
|---|---|---|---|---|---|
| `deepseek/deepseek-v4-flash` | MIT (HF API; V3.2 LICENSE text read: MIT) | 0.091 / 0.182 | OpenInference 0.040/0.136 | 16 incl. DeepInfra, Parasail, Azure | 0.09 |
| `qwen/qwen3-235b-a22b-2507` | Apache-2.0 (HF API) | 0.09 / 0.55 | GMICloud 0.087/0.350 | DeepInfra, GMICloud, Google, Nebius, Parasail, Venice | 0.23 |
| `mistralai/mistral-small-3.2-24b-instruct` | Apache-2.0 (HF API) | 0.0938 / 0.25 | DeepInfra 0.075/0.200 | DeepInfra, Mistral, Parasail, Venice | 0.11 |
| `google/gemma-4-31b-it` | Apache-2.0 ([licence page](https://ai.google.dev/gemma/docs/gemma_4_license) read) | 0.20 / 0.40 | CoreWeave 0.100/0.340 | 12 incl. DeepInfra, Novita, Parasail | 0.19 |
| `z-ai/glm-4.5-air` | MIT (HF API) | 0.13 / 0.85 | Novita 0.130/0.850 | Novita, SiliconFlow, Z.AI | 0.36 (reasoning tokens extra) |

### Test-side models (different families from training; outputs used only for scoring)

| model id | licence (verified how) | listed price in/out | cheapest host seen | hosts | est. $ per 1k prompts* | why test-side |
|---|---|---|---|---|---|---|
| `meta-llama/llama-3.3-70b-instruct` | Llama 3.3 Community Licence ([text read](https://github.com/meta-llama/llama-models/blob/main/models/llama3_3/LICENSE)) + AUP | 0.10 / 0.32 | DeepInfra 0.100/0.320 | 10 incl. DeepInfra, Groq, Together | 0.14 | §1.b.i: training a model on Llama outputs requires "Llama" at the start of that model's name, so test only. AUP not re-read: unverified |
| `nvidia/nemotron-3-super-120b-a12b` | NVIDIA Nemotron Open Model Licence, last modified 2025-12-15 ([text read](https://www.nvidia.com/en-us/agreements/enterprise-software/nvidia-nemotron-open-model-license/)): "NVIDIA does not claim ownership to any outputs" | 0.08 / 0.45 | DekaLLM 0.080/0.450 | Crusoe, DeepInfra, DekaLLM | 0.19 | family separation |
| `microsoft/phi-4` | MIT (HF API) | 0.07 / 0.14 | DeepInfra 0.056/0.112 | DeepInfra only | 0.07 | family separation; 16k context |
| `xiaomi/mimo-v2.5` | MIT (HF API) | 0.14 / 0.28 | GMICloud 0.119/0.238 | GMICloud, Novita, StreamLake, Venice, Xiaomi | 0.13 | family separation |
| `ibm-granite/granite-4.2-8b` | Apache-2.0 (HF API) | 0.06 / 0.25 | DeepInfra 0.060/0.250 | CoreWeave, DeepInfra | 0.11 | small-model behaviour |
| `moonshotai/kimi-k2.5` | modified MIT (HF API + LICENSE text read: attribution only above 100M MAU or $20M/month revenue) | 0.50 / 2.50 | AtlasCloud 0.490/2.500 | Bedrock, AtlasCloud, Novita, SiliconFlow, Venice | 1.08 (reasoning tokens extra) | strong model; optional |

\* Estimate: 150 input + 400 output tokens per prompt at the listed price, with no reasoning tokens. For
reasoning models, turn reasoning off or set a cap. At these rates, 3,000 test prompts × 4 test models plus
6,000 training prompts × 3 training models comes to roughly **$3–6**, well inside the $50 OpenRouter cap
(stop and report at $25).

### Considered and not shortlisted

| provider | reason (terms read) |
|---|---|
| Anthropic (`anthropic/*`) | [Usage Policy](https://www.anthropic.com/legal/aup) forbids instructing the model to produce harmful outputs "(e.g., jailbreaking or prompt injection), without prior authorization from Anthropic", and using "outputs to train an AI model ... without prior authorization". It also forbids generating sexually explicit content. Neither split works without separate Anthropic authorization. |
| Google Gemini API (`google/gemini-*`) | [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms) (effective 2026-03-23): "You may not attempt to bypass these protective measures", plus the Prohibited Use Policy. They also bar using the Services to "develop models that compete". Not shortlisted until Google's position on red-team prompts is clear. (Gemma open weights are separate and shortlisted above.) |
| `z-ai/glm-5.3` | HF licence "other / glm-5.3": text not read, unverified |
| `minimax/minimax-m2.5` | HF says modified-MIT, but the linked LICENSE URL returned 404: unverified |
| `x-ai/*`, `amazon/*`, `cohere/*`, `qwen/*-plus/max` (closed) | terms not read in this pass: unverified |
| `openai/*` | excluded by rule |

## Test vs training split suggestion

- **Different models:** training = DeepSeek V4 Flash, Qwen3-235B-2507, Mistral Small 3.2, Gemma 4 31B,
  GLM-4.5-Air. Test = Llama 3.3 70B, Nemotron 3 Super, Phi-4, MiMo-V2.5, Granite 4.2 8B (Kimi K2.5
  optional). No family appears on both sides.
- **Different prompt sets:** see RED-TEAM-PROMPT-SETS.md (test = AILuminate DEMO, SimpleSafetyTests, XSTest).
- Record per model: model id, pinned host, host terms URL plus the date read, OpenRouter terms date, licence
  sha (from HF), prices on the run date, and the OpenRouter red-teaming approval reference.

## Draft for Justin: red-teaming approval request (not sent)

To: safety@openrouter.ai
Subject: Red-teaming approval request — AIRP open safety-evaluator research (non-default, open source)

> Hello, I'm Justin Flores. I maintain AIRP (github.com/AIRP-spec/inference-advocate), an open protocol and
> reference client whose local evaluator classifies model responses for safety classes (self-harm,
> violence, sexual content, hate, criminal assistance, and similar). I'd like approval to send public
> safety-benchmark prompt sets to the models listed below, collect their responses, and use those
> responses to evaluate and train an open-source on-device classifier.
>
> - Prompt sets: MLCommons AILuminate v1.0 DEMO, NVIDIA Aegis 2.0, SimpleSafetyTests, XSTest,
>   Do-Not-Answer, HarmBench, JailbreakBench behaviors, StrongREJECT (custom rows). Every
>   child-sexual-exploitation category is removed before any request, and we do not send any request
>   that seeks sexual content involving minors.
> - Techniques: the published prompts as written. No jailbreak templates, no prompt injection, no
>   attempts to disable provider safety systems. (Edit this if jailbreak variants are wanted.)
> - Models and hosts: [the shortlist above, one pinned host each].
> - Volume and timeline: about 9,000 prompts per model at most, starting after approval and running
>   through November 2026. Spend is capped at $50.
> - Outputs and the resulting classifier will be published openly, with per-model terms recorded.
>
> Thank you, Justin Flores
