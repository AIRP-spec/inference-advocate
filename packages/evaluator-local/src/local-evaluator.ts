// On-device semantic evaluator: a pinned small language model running in-process.
//
// Paper: step 8. Provisional: Sections 3.3 and 3.4 (reproducible verdicts, on-device
// deployment tier). This is the preferred tier of the hierarchy, occupied here by one small
// universal model rather than a ladder. Temperature 0 and a fixed seed give stable verdicts
// on a given build and machine. Bit-identical verdicts across differing hardware are not
// promised. Do not claim more.
//
// Template v2.1 keeps v2's per-class judgment content and changes decode mechanics: thinking
// is closed in the chat-template prefix, each verdict is a grammar-constrained yes or no,
// evidence is a second call only when a class fires, and the shared prefix is reused on one
// sequence via adaptStateToTokens. v1's eleven-way call is not kept live. The 22 smoke
// identities remain the live-pin check. Template v3 (compact multi-label line) is
// defined in prompt-v3.ts for training. The live path stays v2.1 until a trained
// pin passes the held-out gate under data/evaluator-gate/.
//
// Core never imports this file. The host injects a factory through resolveEvaluator.

import { basename } from 'node:path';
import type { EvaluationRequest, Evaluator, Flag, FlagDefinition, LocalEvaluatorConfig, Taxonomy } from '@airp/core';
import type { ChatHistoryItem, Token } from 'node-llama-cpp';
import {
  getLlama,
  LlamaContextSequence,
  LlamaGrammar,
  LlamaGrammarEvaluationState,
  LlamaLogLevel,
  LlamaModel,
  LlamaText,
  QwenChatWrapper,
  SpecialTokensText,
} from 'node-llama-cpp';
import { verifyModelSha256 } from './digest.js';
import {
  buildClassEvidenceQuestion,
  buildClassVerdictQuestion,
  buildSharedPrefix,
  looksLikeThinking,
  parseEvidenceSpan,
  parseVerdict,
  PROMPT_TEMPLATE_VERSION,
} from './prompt-v2.js';

export { PROMPT_TEMPLATE_VERSION };

const VERDICT_GBNF = 'root ::= "yes" | "no"';
const EVIDENCE_GBNF = 'root ::= [^<>\\n]+';
const VERDICT_MAX_TOKENS = 4;
const EVIDENCE_MAX_TOKENS = 48;

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
  model: LlamaModel;
  sequence: LlamaContextSequence;
  wrapper: QwenChatWrapper;
  verdictGrammar: LlamaGrammar;
  evidenceGrammar: LlamaGrammar;
  systemInfo: string;
};

export class LocalEvaluator implements Evaluator {
  readonly id = 'local-llm';
  readonly version: string;
  readonly #taxonomy: Taxonomy;
  readonly #opts: LocalEvaluatorOptions;
  readonly #digest: string;
  #loaded: LoadedRuntime | undefined;
  #queue: Promise<void> = Promise.resolve();

  /** Raw generated text of the most recent per-class verdict call, keyed by class type. */
  lastRawByClass: Record<string, string> = {};
  /** Wall time of the most recent evaluate() across every class, milliseconds. */
  lastEvalMs = 0;
  /** llama.cpp system-info line from the loaded build. Empty until load(). */
  systemInfo = '';
  /** True when any raw generation in the last evaluate() contained a think tag. */
  lastThoughtDetected = false;

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
    this.systemInfo = llama.systemInfo.trim();
    console.log(`local-llm@${this.version}: llama.cpp system-info: ${this.systemInfo}`);

    const model = await llama.loadModel({ modelPath: this.#opts.modelPath });
    const context = await model.createContext({
      contextSize: this.#opts.contextSize ?? 4096,
      // One sequence. Prefix reuse is adaptStateToTokens on that sequence, not parallel
      // contexts. swaFullCache keeps the shared prefix addressable if the model uses SWA.
      sequences: 1,
      swaFullCache: true,
    });
    const sequence = context.getSequence();
    const wrapper = new QwenChatWrapper({ thoughts: 'discourage', variation: '3' });
    const verdictGrammar = await llama.createGrammar({ grammar: VERDICT_GBNF });
    const evidenceGrammar = await llama.createGrammar({ grammar: EVIDENCE_GBNF });
    this.#loaded = { model, sequence, wrapper, verdictGrammar, evidenceGrammar, systemInfo: this.systemInfo };
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
    this.lastThoughtDetected = false;
    const perCallMs = this.#opts.timeoutMs ?? 30_000;
    const shared = buildSharedPrefix(req);

    // System block only, no assistant turn. Class prompts wrap the same system text, so
    // adaptStateToTokens keeps these KV cells and evaluates only the per-class suffix.
    const prefixTokens = LlamaText([
      new SpecialTokensText('<|im_start|>system\n'),
      shared,
      new SpecialTokensText('<|im_end|>\n'),
    ]).tokenize(loaded.model.tokenizer);
    await loaded.sequence.adaptStateToTokens(prefixTokens, false);
    const remainingPrefix = prefixTokens.slice(loaded.sequence.nextTokenIndex);
    if (remainingPrefix.length > 0) {
      await loaded.sequence.evaluateWithoutGeneratingNewTokens(remainingPrefix);
    }
    if (loaded.sequence.needsCheckpoints) await loaded.sequence.takeCheckpoint();

    for (const def of this.#taxonomy.flags) {
      const verdictTokens = this.#tokenizeHistory(loaded, [
        { type: 'system', text: shared },
        { type: 'user', text: buildClassVerdictQuestion(def) },
        { type: 'model', response: [] },
      ]);
      let raw = '';
      try {
        raw = await this.#generate(loaded, verdictTokens, loaded.verdictGrammar, VERDICT_MAX_TOKENS, perCallMs);
      } catch (err) {
        console.warn(
          `local-llm@${this.version}: generation failed for ${def.type} (${(err as Error).message}); treating as not fired`,
        );
        this.lastRawByClass[def.type] = '';
        continue;
      }

      this.lastRawByClass[def.type] = raw;
      if (looksLikeThinking(raw)) {
        this.lastThoughtDetected = true;
        console.warn(`local-llm@${this.version}: think tag in verdict for ${def.type}: ${JSON.stringify(raw)}`);
      }

      const parsed = parseVerdict(raw);
      if (parsed.unparseable) {
        console.warn(
          `local-llm@${this.version}: unparseable verdict for ${def.type} (${JSON.stringify(raw)}); treating as not fired`,
        );
        continue;
      }
      if (!parsed.fired) continue;

      const evidence = await this.#evidenceFor(loaded, shared, def, req.content, perCallMs);
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

  async #evidenceFor(
    loaded: LoadedRuntime,
    shared: string,
    def: FlagDefinition,
    evaluated: string,
    timeoutMs: number,
  ): Promise<Flag['evidence']> {
    const evidenceTokens = this.#tokenizeHistory(loaded, [
      { type: 'system', text: shared },
      { type: 'user', text: buildClassEvidenceQuestion(def) },
      { type: 'model', response: [] },
    ]);
    let raw = '';
    try {
      raw = await this.#generate(loaded, evidenceTokens, loaded.evidenceGrammar, EVIDENCE_MAX_TOKENS, timeoutMs);
    } catch (err) {
      console.warn(
        `local-llm@${this.version}: evidence generation failed for ${def.type} (${(err as Error).message}); recording evidence null`,
      );
      return [];
    }
    if (looksLikeThinking(raw)) {
      this.lastThoughtDetected = true;
      console.warn(`local-llm@${this.version}: think tag in evidence for ${def.type}: ${JSON.stringify(raw)}`);
    }
    const span = parseEvidenceSpan(raw, evaluated);
    if (span === null) {
      console.warn(
        `local-llm@${this.version}: evidence for ${def.type} is not a verbatim span; recording evidence null. raw=${JSON.stringify(raw.slice(0, 180))}`,
      );
      return [];
    }
    const idx = evaluated.indexOf(span);
    return [{ start: idx, end: idx + span.length, text: span }];
  }

  #tokenizeHistory(loaded: LoadedRuntime, chatHistory: ChatHistoryItem[]): Token[] {
    const { contextText } = loaded.wrapper.generateContextState({ chatHistory });
    return contextText.tokenize(loaded.model.tokenizer);
  }

  async #generate(
    loaded: LoadedRuntime,
    promptTokens: Token[],
    grammar: LlamaGrammar,
    maxTokens: number,
    timeoutMs: number,
  ): Promise<string> {
    // adaptStateToTokens erases from the first differing token, so the shared system
    // prefix stays in the KV cache across the eleven class calls on this sequence.
    await loaded.sequence.adaptStateToTokens(promptTokens, false);
    let remaining = promptTokens.slice(loaded.sequence.nextTokenIndex);
    if (remaining.length === 0) {
      if (promptTokens.length === 0) return '';
      const lastIndex = loaded.sequence.nextTokenIndex - 1;
      await loaded.sequence.eraseContextTokenRanges([{ start: lastIndex, end: lastIndex + 1 }]);
      remaining = promptTokens.slice(-1);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const generated: Token[] = [];
    try {
      const grammarState = new LlamaGrammarEvaluationState({ model: loaded.model, grammar });
      for await (const token of loaded.sequence.evaluate(remaining, {
        temperature: this.#opts.temperature ?? 0,
        seed: this.#opts.seed ?? 1,
        grammarEvaluationState: grammarState,
      })) {
        if (controller.signal.aborted) {
          throw new Error('timed out');
        }
        if (loaded.model.isEogToken(token)) break;
        generated.push(token);
        if (generated.length >= maxTokens) break;
      }
    } finally {
      clearTimeout(timer);
    }
    return loaded.model.detokenize(generated, true);
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
