// Model evaluator: the semantic layer as the paper actually wants it, pointed at whatever
// OpenAI-compatible endpoint the user is willing to run.
//
// Paper: step 8. Provisional: Sections 3.3 and 3.4 (deployment hierarchy).
//
// Two warnings belong on this file rather than in a document nobody reads.
//
// First, running this against a hosted frontier model breaks the independence property: the
// evaluator's provenance must be separate from the provider under audit, and pointing this at
// the same company's model to judge that company's model is the self-audit conflict by
// another route. The intended deployment is a local model on the user's own device, which is
// the preferred tier in the provisional anyway.
//
// Second, this evaluator sends response content to whatever endpoint it is configured with.
// That is content leaving the device. It is off by default for that reason, and the export
// view reports it as an outbound path when it is on.

import type { EvaluationRequest, Evaluator } from '../semantic.js';
import type { Flag } from '../../types.js';
import type { Taxonomy } from '../taxonomy.js';
import { buildTaxonomyEvaluationPrompt, parseTaxonomyEvaluationVerdict } from './taxonomy-prompt.js';

export interface ModelEvaluatorOptions {
  baseUrl: string;
  model: string;
  apiKey?: string;
  /** Fixed decoding parameters, because reproducibility is a required property. */
  temperature?: number;
  seed?: number;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class ModelEvaluator implements Evaluator {
  readonly id = 'airp-model-evaluator';
  readonly version: string;
  readonly #taxonomy: Taxonomy;
  readonly #opts: ModelEvaluatorOptions;

  constructor(taxonomy: Taxonomy, opts: ModelEvaluatorOptions) {
    this.#taxonomy = taxonomy;
    this.#opts = opts;
    this.version = `0.1.0+model.${opts.model}+tax.${taxonomy.version}`;
  }

  buildPrompt(req: EvaluationRequest): string {
    return buildTaxonomyEvaluationPrompt(this.#taxonomy, req);
  }

  async evaluate(req: EvaluationRequest): Promise<Flag[]> {
    const doFetch = this.#opts.fetchImpl ?? fetch;
    const url = this.#opts.baseUrl.replace(/\/$/, '') + '/chat/completions';
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.#opts.apiKey) headers['authorization'] = `Bearer ${this.#opts.apiKey}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#opts.timeoutMs ?? 60_000);
    let res: Response;
    try {
      res = await doFetch(url, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: this.#opts.model,
          temperature: this.#opts.temperature ?? 0,
          seed: this.#opts.seed ?? 1,
          messages: [{ role: 'user', content: this.buildPrompt(req) }],
          stream: false,
        }),
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) throw new Error(`evaluator endpoint returned ${res.status}`);
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
    const text = json.choices?.[0]?.message?.content ?? '{"flags":[]}';
    return this.parse(text, req.content);
  }

  /** Exported for tests, and because a parser that silently swallows garbage is a liability. */
  parse(text: string, evaluated: string): Flag[] {
    return parseTaxonomyEvaluationVerdict(this.#taxonomy, text, evaluated, 'model').flags;
  }
}
