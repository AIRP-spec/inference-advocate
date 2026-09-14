// @airp/evaluator-local: in-process GGUF evaluator for the semantic layer.
//
// Paper: step 8. Provisional: Sections 3.3 and 3.4.
// Core defines Evaluator. This package is the on-device implementation. Hosts inject it.

export {
  LocalEvaluator,
  createLocalEvaluator,
  localGgufLoadOptions,
  LOAD_WARMUP_REQUEST,
  warmAtLoad,
  PROMPT_TEMPLATE_VERSION,
  modelFileName,
  type LocalEvaluatorOptions,
  type LocalEvaluatorObservables,
} from './local-evaluator.js';
export {
  buildSharedPrefix,
  buildClassVerdictQuestion,
  buildClassEvidenceQuestion,
  buildClassEvaluationPrompt,
  parseVerdict,
  parseEvidenceSpan,
  looksLikeThinking,
} from './prompt-v2.js';
export {
  PROMPT_TEMPLATE_V3,
  taxonomyTypes,
  serializeCompactVerdict,
  compactVerdictGbnf,
  parseCompactVerdict,
  buildV3System,
  buildV3User,
  buildV3ChatTurns,
  buildV3EvaluationPrompt,
  type ParsedCompactVerdict,
} from './prompt-v3.js';
export {
  PROMPT_TEMPLATE_V4,
  PRIMITIVES_CATALOGUE_V1,
  serializeCompactPrimitives,
  parseCompactPrimitives,
  compactPrimitivesGbnf,
  buildV4System,
  buildV4User,
  buildV4ChatTurns,
  buildV4EvaluationPrompt,
  promptSha256,
  PER_PRIMITIVE_STUB,
  type PrimitivesCatalogue,
  type PrimitivesVerdict,
  type ParsedCompactPrimitives,
  type PerPrimitiveStub,
} from './prompt-v4.js';
export { verifyModelSha256, sha256FileHex, normalizeDigest } from './digest.js';
export {
  HELD_OUT_GATE_FILE,
  HELD_OUT_SUITE_FILE,
  loadGateConfigFromFile,
  loadHeldOutSuiteFromFile,
  mean,
  scoreHeldOutGate,
  scoreHeldOutGateDual,
  smokeIdentities,
  type DualGateScore,
  type GateConfig,
  type GateItemResult,
  type GateScore,
  type HeldOutItem,
  type HeldOutKind,
  type HeldOutOrigin,
  type HeldOutSuite,
  type ItemVerdict,
} from './held-out-gate.js';
