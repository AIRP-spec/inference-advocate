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
export { verifyModelSha256, sha256FileHex, normalizeDigest } from './digest.js';
