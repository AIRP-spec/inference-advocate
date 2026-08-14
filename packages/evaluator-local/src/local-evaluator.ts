// On-device semantic evaluator: a pinned small language model running in-process.
//
// Paper: step 8. Provisional: Sections 3.3 and 3.4 (reproducible verdicts, on-device
// deployment tier). This is the preferred tier of the hierarchy, occupied here by one small
// universal model rather than a ladder. Temperature 0 and a fixed seed give stable verdicts
// on a given build and machine. Bit-identical verdicts across differing hardware are not
// promised. Do not claim more. The golden fixtures are the acceptance gate for this pin;
// Qwen3-0.6B does not yet pass them. See ARCHITECTURE.md. This file still loads and
// attributes the pin. It does not claim the judge is adequate.
//
// Core never imports this file. The host injects a factory through resolveEvaluator.

import { basename } from 'node:path';
import {
  parseTaxonomyEvaluationVerdict,
  taxonomyEvaluationInstructions,
  TAXONOMY_EVALUATION_PROMPT_VERSION,
  type EvaluationRequest,
  type Evaluator,
  type Flag,
  type LocalEvaluatorConfig,
  type ParsedTaxonomyVerdict,
  type Taxonomy,
} from '@airp/core';
import { getLlama, LlamaChatSession, LlamaGrammar, LlamaLogLevel, QwenChatWrapper } from 'node-llama-cpp';
import { verifyModelSha256 } from './digest.js';

export const PROMPT_TEMPLATE_VERSION = TAXONOMY_EVALUATION_PROMPT_VERSION;

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

  lastRawText = '';

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
      // The pinned reference is Qwen3. Discouraging thoughts keeps the completion in the JSON
      // contract instead of a reasoning preamble the parser would have to strip.
      chatWrapper: new QwenChatWrapper({ thoughts: 'discourage', variation: '3' }),
      systemPrompt: taxonomyEvaluationInstructions(this.#taxonomy),
    });
    const grammar = await llama.createGrammarForJsonSchema({
      type: 'object',
      additionalProperties: false,
      properties: {
        flags: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              type: {
                type: 'string',
                enum: this.#taxonomy.flags.map((f) => f.type),
              },
              evidence: { type: 'array', items: { type: 'string' } },
              reason: { type: 'string' },
            },
            required: ['type', 'evidence', 'reason'],
          },
        },
      },
      required: ['flags'],
    });
    this.#loaded = { session, grammar };
  }

  parse(text: string, evaluated: string): ParsedTaxonomyVerdict {
    return parseTaxonomyEvaluationVerdict(this.#taxonomy, text, evaluated, 'local');
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

    loaded.session.resetChatHistory();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#opts.timeoutMs ?? 120_000);
    let text = '';
    const userTurn = [
      req.prompt ? `User turn:\n${req.prompt}\n` : '',
      `Assistant response under evaluation:\n${req.content}`,
    ].join('\n');
    try {
      text = await loaded.session.prompt(userTurn, {
        temperature: this.#opts.temperature ?? 0,
        seed: this.#opts.seed ?? 1,
        grammar: loaded.grammar,
        maxTokens: 512,
        signal: controller.signal,
        budgets: { thoughtTokens: 0 },
      });
    } catch (err) {
      this.lastRawText = '';
      console.warn(
        `local-llm@${this.version}: generation failed (${(err as Error).message}); recording zero flags`,
      );
      return [];
    } finally {
      clearTimeout(timer);
    }

    this.lastRawText = text;
    const parsed = this.parse(text, req.content);
    if (parsed.unparseable) {
      console.warn(
        `local-llm@${this.version}: unparseable model response; recording zero flags`,
      );
    }
    return parsed.flags;
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
