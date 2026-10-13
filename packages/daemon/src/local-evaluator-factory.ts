// Host injection of the on-device evaluator.
//
// Paper: step 8. Provisional: Section 3.4 (on-device tier).
// Core refuses to import the native runtime. The daemon and the desktop launcher pass this
// factory into openAdvocate so kind: 'local' can actually construct. The import is dynamic so
// a daemon running the rule evaluator never loads llama.cpp.

import type { Evaluator, LocalEvaluatorConfig, Taxonomy } from '@airp/core';

export async function localEvaluatorFactory(
  cfg: LocalEvaluatorConfig,
  taxonomy: Taxonomy,
): Promise<Evaluator> {
  const { createOnDeviceEvaluator } = await import('@airp/evaluator-local');
  // Whole config, including optional promptTemplateVersion and engine. Do not pick fields here.
  // Omitted engine is the GGUF live pin; engine 'laya-onnx' is the Laya evaluator, off by default.
  return createOnDeviceEvaluator(cfg, taxonomy);
}
