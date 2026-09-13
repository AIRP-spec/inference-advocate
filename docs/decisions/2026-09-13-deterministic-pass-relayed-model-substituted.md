# Decision record: deterministic pass aligned to draft §6.10 (relayed, model_substituted)

Date: 2026-09-13  
Status: **applied**. Verifier, types, and tests committed; UI wording validated locally and pending a Cursor commit; no register, key, or demo pin touched  
Spec: draft-flores-airp-provenance-00 §6.10  
Repo: AIRP-spec/inference-advocate  
Source: review of the reference verifier against the FG-TIDA use case "Silent model substitution by an intermediary" (Justin Philip Flores, this date)

This record documents two places where `packages/core/src/monitor/deterministic.ts` diverged from the draft it cites, and what was changed to close them.

---

## Divergence 1: endpoint mismatch refused where §6.10 says report

§6.10 (MUST language): where the contacted endpoint does not match the entry and a seal over the response validates against the selected entry, the verifier reports the response as **relayed**, not unattributed. This is not a refusing finding. The contacted endpoint is reported alongside the attribution.

The verifier emitted `endpoint_not_authorized` with `refuses: true` for every endpoint mismatch, seal or no seal. That contradicted the draft on exactly the finding the use case is built around, and it made the reference implementation fail row 5 of that use case while being cited as its existence proof.

**Change.** The endpoint check now runs after the final `sealValid` is known (after the compromised, retired, and unknown-binding adjustments) and splits:

- `sealValid === true` and endpoint not in entry → `relayed`, `refuses: false`, detail carries the contacted endpoint. The response stays attributed to the entry.
- no valid seal and endpoint not in entry → `endpoint_not_authorized`, `refuses: true`, unchanged.

`endpointAuthorized` on the verdict remains `false` in both cases; it reports the fact, the finding reports what the fact means.

## Divergence 2: no finding for an honest seal over a model the client did not request

§6.10's own example is a router asked for model X that relays the same provider's honest seal for cheaper model Y. The draft says the model field reads Y, the caller asked for X, and the substitution is on the face of the response. The verifier checked only that the entry is registered to serve the sealed model (`seal_model_mismatch`). It never compared `seal.model` to `provider.model`, the model the client asked for. The draft's example produced no finding.

**Change.** New finding `model_substituted`, raised when the seal validates, the entry is registered to serve the sealed model, and `seal.model !== provider.model`. `refuses: false`. Distinct from `seal_model_mismatch`, which is about what the entry may serve, not what the client requested.

**Open choice.** `model_substituted` is reported, not refusing, to match the draft's pattern that provenance findings are reported and the Delivery Policy decides. If the policy layer should be able to refuse on it, that is a policy change, not a verifier change. Flip `refuses` in one line if the decision goes the other way.

---

## Files changed

- `packages/core/src/monitor/deterministic.ts`: endpoint block moved after sealValid adjustments and split; `model_substituted` added after the model-registered check
- `packages/core/src/types.ts`: `relayed` and `model_substituted` added to `DeterministicFindingCode`
- `packages/core/test/monitor.test.ts`: the refusal test replaced by the §6.10 case; four tests added (unsealed unregistered endpoint still refuses; invalid seal from unregistered endpoint refuses and is not relayed; honest seal for an unrequested registered model is substituted; the requested model raises nothing)
- `packages/ui/src/App.tsx`: `provenanceLine` distinguishes relayed and substituted. Validated locally (UI suite 19 pass) and handed to Justin as a copy-paste block for Cursor rather than committed through the MCP, since the file is large enough that a transcription error would break the UI build. Until it lands, the provenance line still reads "endpoint NOT authorized" for a relayed response.

## Verification

- `@airp/core`: 143 pass, 0 fail (was 139)
- `@airp/ui`: 19 pass
- `@airp/demo`: 2 pass
- `@airp/daemon`: 8 pass

## Not changed

- Register documents, keys, DNS records, demo pins
- `deploy/verify-public-seal.mjs` and `verify-public-stream.mjs` (acceptance scripts exercise the authorized-endpoint path and are unaffected)
- The client still loads the register from local storage; HTTPS fetch of the published document remains separate work (see `deploy/README.md`)

## Follow-ups

- Public mock `cheapai.win` could be pointed at a second registered model on its own entry to exercise `model_substituted` live. Not done here; it touches the public register.
- The FG-TIDA use case's negative test case 2 should read: seal claims entry B while the client contacted A, refusing `seal_entry_mismatch` reporting the claimed entry, no attribution, endpoint E reported. The verifier never attributes from the response (see the DKIM `d=` note at the top of `runDeterministicPass`).
