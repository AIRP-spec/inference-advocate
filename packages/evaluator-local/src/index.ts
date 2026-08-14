// @airp/evaluator-local: in-process GGUF evaluator for the semantic layer.
//
// Paper: step 8. Provisional: Sections 3.3 and 3.4.
// Core defines Evaluator. This package is the on-device implementation. Hosts inject it.

export {
  LocalEvaluator,
  createLocalEvaluator,
  PROMPT_TEMPLATE_VERSION,
  modelFileName,
  type LocalEvaluatorOptions,
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
export { verifyModelSha256, sha256FileHex, normalizeDigest } from './digest.js';
