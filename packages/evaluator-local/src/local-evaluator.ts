// On-device semantic evaluator: a pinned small language model running in-process.
//
// Paper: step 8. Provisional: Sections 3.3 and 3.4 (reproducible verdicts, on-device
// deployment tier). This is the preferred tier of the hierarchy, occupied here by one small
// universal model rather than a ladder. Temperature 0 and a fixed seed give stable verdicts
// on a given build and machine. Bit-identical verdicts across differing hardware are not
// promised. Do not claim more.
//
// Template v2 asks one binary judgment per taxonomy class, sequentially, against a single
// loaded model. v1's eleven-way call is not kept live. The golden fixtures remain the
// acceptance gate.
//
// Core never imports this file. The host injects a factory through resolveEvaluator.

import { basename } from 'node:path';
import type { EvaluationRequest, Evaluator, Flag, LocalEvaluatorConfig, Taxonomy } from '@airp/core';
import { getLlama, LlamaChatSession, LlamaGrammar, LlamaLogLevel, QwenChatWrapper } from 'node-llama-cpp';
import { verifyModelSha256 } from './digest.js';
import {
  buildClassEvaluationPrompt,
  parseBinaryVerdict,
  PROMPT_TEMPLATE_VERSION,
} from './prompt-v2.js';

export { PROMPT_TEMPLATE_VERSION };

export interface LocalEvaluatorOptions {
  taxonomy: Taxonomy;
  modelPath: string;
  modelSha256: string;
  contextSize?: number;
  gpu?: boolean;
  timeoutMs?: number;
  temperature?: number;
  seed?: number;
}

type LoadedRuntime = {
  session: LlamaChatSession;
  grammar: LlamaGrammar;
};

export class LocalEvaluator implements Evaluator {
  readonly id = 'local-llm';
  readonly version: string;
  readonly #taxonomy: Taxonomy;
  readonly #opts: LocalEvaluatorOptions;
  readonly #digest: string;
  #loaded: LoadedRuntime | undefined;
  #queue: Promise<void> = Promise.resolve();

  /** Raw model text of the most recent per-class call, keyed by class type. */
  lastRawByClass: Record<string, string> = {};
  /** Wall time of the most recent evaluate() across every class, milliseconds. */
  lastEvalMs = 0;

  constructor(opts: LocalEvaluatorOptions) {
    this.#taxonomy = opts.taxonomy;
    this.#opts = opts;
    this.#digest = verifyModelSha256(opts.modelPath, opts.modelSha256);
    this.version = `${this.#digest.slice(0, 12)}+${PROMPT_TEMPLATE_VERSION}`;
  }

  async load(): Promise<void> {
    if (this.#loaded) return;

    const llama = await getLlama({
      gpu: this.#opts.gpu ? 'auto' : false,
      progressLogs: false,
      logLevel: LlamaLogLevel.error,
    });
    const model = await llama.loadModel({ modelPath: this.#opts.modelPath });
    const context = await model.createContext({
      contextSize: this.#opts.contextSize ?? 4096,
    });
    const session = new LlamaChatSession({
      contextSequence: context.getSequence(),
      chatWrapper: new QwenChatWrapper({ thoughts: 'discourage', variation: '3' }),
    });
    const grammar = await llama.createGrammarForJsonSchema({
      type: 'object',
      additionalProperties: false,
      properties: {
        fired: { type: 'boolean' },
        evidence: { oneOf: [{ type: 'string' }, { type: 'null' }] },
      },
      required: ['fired', 'evidence'],
    });
    this.#loaded = { session, grammar };
  }

  async evaluate(req: EvaluationRequest): Promise<Flag[]> {
    const previous = this.#queue;
    let release: () => void = () => undefined;
    this.#queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await this.#evaluateLocked(req);
    } finally {
      release();
    }
  }

  async #evaluateLocked(req: EvaluationRequest): Promise<Flag[]> {
    await this.load();
    const loaded = this.#loaded;
    if (!loaded) throw new Error('local evaluator failed to load');

    const started = Date.now();
    const flags: Flag[] = [];
    this.lastRawByClass = {};
    const perClassMs = this.#opts.timeoutMs ?? 30_000;

    for (const def of this.#taxonomy.flags) {
      loaded.session.resetChatHistory();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), perClassMs);
      let text = '';
      try {
        text = await loaded.session.prompt(buildClassEvaluationPrompt(def, req), {
          temperature: this.#opts.temperature ?? 0,
          seed: this.#opts.seed ?? 1,
          grammar: loaded.grammar,
          maxTokens: 128,
          signal: controller.signal,
          budgets: { thoughtTokens: 0 },
        });
      } catch (err) {
        console.warn(
          `local-llm@${this.version}: generation failed for ${def.type} (${(err as Error).message}); treating as not fired`,
        );
        this.lastRawByClass[def.type] = '';
        continue;
      } finally {
        clearTimeout(timer);
      }

      this.lastRawByClass[def.type] = text;
      const parsed = parseBinaryVerdict(text, req.content);
      if (parsed.unparseable) {
        console.warn(
          `local-llm@${this.version}: unparseable model response for ${def.type}; treating as not fired`,
        );
        continue;
      }
      if (!parsed.fired) continue;
      const excerpt = parsed.evidence;
      const idx = excerpt !== null ? req.content.indexOf(excerpt) : -1;
      const evidence =
        excerpt !== null && idx >= 0
          ? [{ start: idx, end: idx + excerpt.length, text: excerpt }]
          : [];
      flags.push({
        type: def.type,
        severity: def.severity,
        evidence,
        basis: `${this.#taxonomy.version}:local:${def.type}`,
      });
    }

    this.lastEvalMs = Date.now() - started;
    console.log(
      `local-llm@${this.version}: evaluated ${this.#taxonomy.flags.length} classes in ${this.lastEvalMs}ms`,
    );
    return flags;
  }
}

export async function createLocalEvaluator(
  cfg: LocalEvaluatorConfig,
  taxonomy: Taxonomy,
): Promise<LocalEvaluator> {
  const evaluator = new LocalEvaluator({
    taxonomy,
    modelPath: cfg.modelPath,
    modelSha256: cfg.modelSha256,
    contextSize: cfg.contextSize,
    gpu: cfg.gpu ?? false,
    timeoutMs: cfg.timeoutMs,
  });
  await evaluator.load();
  return evaluator;
}

/** Hosts print this so a reader can tell which file the pin refers to. */
export function modelFileName(cfg: LocalEvaluatorConfig): string {
  return basename(cfg.modelPath);
}
