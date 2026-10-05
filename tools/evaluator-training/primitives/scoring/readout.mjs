/**
 * Probability readout for the per-primitive-v1 decode shape (Task 2, brief 2026-10-05).
 *
 * One variable: the readout. Same GGUF, same prompts (built by @airp/evaluator-local's
 * buildAllPerPrimitivePrompts + perPrimitiveChatHistory + createEvaluatorChatWrapper, the
 * exact functions LocalEvaluator uses), same composition (shared compose()).
 *
 * - yes/no primitives: P(trained "yes" string) vs P(trained "no" string), normalized over the two.
 * - stance: each of the five trained stance strings scored as a full token sequence
 *   (sum of token log-probs), normalized over the five. No length normalization.
 *
 * Probabilities come from node-llama-cpp's controlledEvaluate(generateNext.probabilities) with
 * temperature 0. At temperature 0 node-llama-cpp's sampler chain is greedy-only (no top-k/top-p),
 * so the returned map is the softmax of the raw logits over the full vocabulary.
 */

export const YES_NO_ANSWERS = ['yes', 'no'];

/** Pure math: normalize summed log-probs over a fixed answer set. */
export function normalizeLogProbs(logProbs) {
  const names = Object.keys(logProbs);
  const max = Math.max(...names.map((n) => logProbs[n]));
  const exps = names.map((n) => (Number.isFinite(logProbs[n]) ? Math.exp(logProbs[n] - max) : 0));
  const z = exps.reduce((a, b) => a + b, 0);
  const probs = {};
  names.forEach((n, i) => {
    probs[n] = exps[i] / z;
  });
  return probs;
}

/** Pure math: argmax with deterministic tie-break on answer order. */
export function argmaxAnswer(probs, order) {
  let best = order[0];
  for (const n of order) if (probs[n] > probs[best]) best = n;
  return best;
}

/** Answer strings for a pass, exactly as the SFT builder emitted them (stance name, or yes/no). */
export function answerStringsForPass(pass, catalogue) {
  if (pass.passType === 'stance') return catalogue.stance.map((s) => s.primitive);
  return YES_NO_ANSWERS;
}

const GEN = { generateNext: { probabilities: true, options: { temperature: 0 } } };

export class PerPrimitiveScorer {
  constructor({ ev, nlc, modelPath, gpu, contextSize = 4096 }) {
    this.ev = ev; // @airp/evaluator-local module
    this.nlc = nlc; // node-llama-cpp module
    this.modelPath = modelPath;
    this.gpu = gpu;
    this.contextSize = contextSize;
    this.catalogue = ev.PRIMITIVES_CATALOGUE_V1;
    this.passes = ev.buildAllPerPrimitivePrompts(this.catalogue);
  }

  async load() {
    const { getLlama, LlamaLogLevel } = this.nlc;
    this.llama = await getLlama({ gpu: this.gpu ? 'auto' : false, progressLogs: false, logLevel: LlamaLogLevel.error });
    this.systemInfo = this.llama.systemInfo.trim();
    this.model = await this.llama.loadModel(this.ev.localGgufLoadOptions(this.modelPath));
    const threads = process.env.AIRP_TASK2_THREADS ? Number(process.env.AIRP_TASK2_THREADS) : undefined; // diagnostics only
    this.context = await this.model.createContext({ contextSize: this.contextSize, sequences: 1, swaFullCache: true, ...(threads ? { threads } : {}) });
    this.seq = this.context.getSequence();
    this.wrapper = this.ev.createEvaluatorChatWrapper();
    this.stanceGrammar = await this.llama.createGrammar({
      grammar: `root ::= ${this.catalogue.stance.map((s) => `"${s.primitive}"`).join(' | ')}`,
    });
    this.yesNoGrammar = await this.llama.createGrammar({ grammar: 'root ::= "yes" | "no"' });
    this.answerTokens = {};
    for (const pass of this.passes) {
      for (const a of answerStringsForPass(pass, this.catalogue)) {
        if (!this.answerTokens[a]) this.answerTokens[a] = this.model.tokenize(a, false);
      }
    }
  }

  /** Prompt tokens for one pass, built exactly as LocalEvaluator.#tokenizeHistory does. */
  passTokens(pass, req) {
    const { contextText } = this.wrapper.generateContextState({
      chatHistory: this.ev.perPrimitiveChatHistory(pass.systemPrompt, req),
    });
    return contextText.tokenize(this.model.tokenizer);
  }

  passContextText(pass, req) {
    const { contextText } = this.wrapper.generateContextState({
      chatHistory: this.ev.perPrimitiveChatHistory(pass.systemPrompt, req),
    });
    return contextText.toString();
  }

  async resetSequence() {
    if (this.seq.nextTokenIndex > 0) {
      await this.seq.eraseContextTokenRanges([{ start: 0, end: this.seq.nextTokenIndex }]);
    }
  }

  /**
   * Greedy generation on the same path as LocalEvaluator.#generate (adaptStateToTokens prefix reuse,
   * temperature 0, seed 1, stop at EOG). maxTokens null = uncapped (bounded only by safetyMax).
   * grammar: 'trained' uses the gate's grammar; null = unconstrained.
   */
  async greedy(promptTokens, grammar, maxTokens, safetyMax = 64) {
    const { LlamaGrammarEvaluationState } = this.nlc;
    await this.seq.adaptStateToTokens(promptTokens, false);
    let remaining = promptTokens.slice(this.seq.nextTokenIndex);
    if (remaining.length === 0) {
      const lastIndex = this.seq.nextTokenIndex - 1;
      await this.seq.eraseContextTokenRanges([{ start: lastIndex, end: lastIndex + 1 }]);
      remaining = promptTokens.slice(-1);
    }
    const cap = maxTokens ?? safetyMax;
    const generated = [];
    let hitEog = false;
    const opts = { temperature: 0, seed: 1 };
    if (grammar) opts.grammarEvaluationState = new LlamaGrammarEvaluationState({ model: this.model, grammar });
    for await (const token of this.seq.evaluate(remaining, opts)) {
      if (this.model.isEogToken(token)) {
        hitEog = true;
        break;
      }
      generated.push(token);
      if (generated.length >= cap) break;
    }
    return {
      text: this.model.detokenize(generated, true),
      tokens: generated,
      stoppedBy: hitEog ? 'eog' : generated.length >= cap ? (maxTokens == null ? 'safetyMax' : 'cap') : 'grammarComplete',
    };
  }

  /**
   * Scored readout for one pass. reuse=false clears the KV cache first so the whole prompt is
   * evaluated; reuse=true keeps whatever prefix is shared with the previous pass. The answers of
   * one pass always share that pass's prompt evaluation (inherent to scoring fixed answers).
   */
  async scorePass(promptTokens, answers, { reuse }) {
    if (!reuse) await this.resetSequence();
    const head = promptTokens.slice(0, -1);
    const last = promptTokens[promptTokens.length - 1];
    await this.seq.adaptStateToTokens(head, false);
    if (this.seq.nextTokenIndex > head.length) throw new Error('sequence longer than prompt head after adapt');
    const rem = head.slice(this.seq.nextTokenIndex);
    if (rem.length > 0) await this.seq.evaluateWithoutGeneratingNewTokens(rem);
    const out0 = await this.seq.controlledEvaluate([[last, GEN]]);
    const dist0 = out0[0].next.probabilities;
    const logProbs = {};
    const perToken = {};
    for (const a of answers) {
      const toks = this.answerTokens[a];
      const p0 = dist0.get(toks[0]) ?? 0;
      let lp = Math.log(p0);
      const tokLp = [Math.log(p0)];
      if (toks.length > 1) {
        if (this.seq.nextTokenIndex > promptTokens.length) {
          await this.seq.eraseContextTokenRanges([{ start: promptTokens.length, end: this.seq.nextTokenIndex }]);
        }
        const res = await this.seq.controlledEvaluate(toks.slice(0, -1).map((t) => [t, GEN]));
        for (let j = 0; j < toks.length - 1; j++) {
          const pj = res[j].next.probabilities.get(toks[j + 1]) ?? 0;
          lp += Math.log(pj);
          tokLp.push(Math.log(pj));
        }
      }
      logProbs[a] = lp;
      perToken[a] = tokLp;
    }
    // leave the sequence at exactly the prompt so the next pass can reuse its prefix
    if (this.seq.nextTokenIndex > promptTokens.length) {
      await this.seq.eraseContextTokenRanges([{ start: promptTokens.length, end: this.seq.nextTokenIndex }]);
    }
    const probs = normalizeLogProbs(logProbs);
    return { logProbs, perToken, probs, top: argmaxAnswer(probs, answers) };
  }

  /** Score all 17 passes for one request. */
  async scoreItem(req, { reuse }) {
    const out = {};
    for (const pass of this.passes) {
      const toks = this.passTokens(pass, req);
      out[pass.primitive] = await this.scorePass(toks, answerStringsForPass(pass, this.catalogue), { reuse });
    }
    return out;
  }

  /** Assemble a PrimitivesVerdict from scored passes with default thresholds (0.5, argmax). */
  verdictFromScored(scored) {
    return verdictFromScoredPasses(this.passes, scored);
  }
}

/** Default-threshold verdict: yes/no fires at P(yes) >= 0.5; stance is the argmax of the five. */
export function verdictFromScoredPasses(passes, scored) {
  const objects = [];
  const qualifiers = [];
  for (const pass of passes) {
    if (pass.passType === 'stance') continue;
    const p = scored[pass.primitive].probs.yes;
    if (p >= 0.5) (pass.passType === 'object' ? objects : qualifiers).push(pass.primitive);
  }
  return { stance: scored.stance.top, objects, qualifiers };
}

/** Same assembly from greedy raw answers (LocalEvaluator semantics: exact 'yes'). */
export function verdictFromRaw(passes, raw) {
  const objects = [];
  const qualifiers = [];
  for (const pass of passes) {
    if (pass.passType === 'stance') continue;
    if (raw[pass.primitive] === 'yes') (pass.passType === 'object' ? objects : qualifiers).push(pass.primitive);
  }
  return { stance: raw.stance, objects, qualifiers };
}

/** LocalEvaluator's stance normalization (belt-and-suspenders for truncation). */
export function normalizeStanceLikeGate(raw) {
  let s = raw.trim().toLowerCase();
  if (s.startsWith('encour')) s = 'encourages';
  else if (s.startsWith('convey')) s = 'conveys_method';
  return s;
}
