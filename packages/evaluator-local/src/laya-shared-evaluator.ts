// Shared-encoding primitives evaluator: the response is encoded once, 17 heads read that one
// encoding. ONNX Runtime (onnxruntime-node), composed through the shared compose.
//
// Off by default. It runs only when an evaluator config sets kind 'local' and engine
// 'laya-shared-onnx'. With no config the host keeps the rule evaluator; with a config that omits
// `engine` the host keeps the GGUF live pin. Nothing in the default path imports this module.
//
// Model: decide 3b shared-encoding checkpoint (run A, epoch 2.5, step 570 at the time of writing;
// the architecture is fixed, the weights are whatever the pins file names). Input
// `[CLS] response [SEP]`, `input_ids [1, L]` int64, L <= max_len (1024). Output `logits [1, 17, 5]`,
// one row per head in the pinned head order; a head's first `width` columns are its logits (stance 5,
// yes/no 2 as [false, true]); the rest are padding columns of the export and are never read.
// Batch 1 and the exact sequence length: nothing is padded. ORT intra-op spinning off (pinned).
//
// What is pinned, and refused on mismatch, before any session opens:
//   - the ONNX graph (modelSha256), checked against the pins file as well as the config;
//   - the pins file itself (laya.pinsSha256): head order and widths, temperature, thresholds,
//     stance order, max_len, the SHAs of shared_config.json and every tokenizer file;
//   - the composition (laya.compositionSha256), which must also equal the pins file's.
//
// Tokenization = the Python gate path (decide 3b common_shared.encode_response): the response text
// with the mask token replaced by a space, tokenized without special tokens by the bundle's
// tokenizer.json (@huggingface/tokenizers, the same library and file @receptron/laya uses for the
// Laya path), cut to its first max_len - 2 tokens, then [CLS] ... [SEP].
// Decisions: layaPrimitivesFromLogits (the same pinned decode as the Laya path and the cross-path test).

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import type { EvaluationRequest, Evaluator, Flag, LocalEvaluatorConfig, Taxonomy } from '@airp/core';
import { sha256FileHex, verifyModelSha256, normalizeDigest } from './digest.js';
import { compose as composePrimitives, type Composition, type PrimitivesVerdict } from './compose-primitives.js';
import { LOAD_WARMUP_REQUEST, warmAtLoad } from './local-evaluator.js';
import { layaPrimitivesFromLogits, type LayaLogits } from './laya-evaluator.js';

export const LAYA_SHARED_PINS_SCHEMA = 'airp-laya-shared-pins/1';
/** File name of the graph inside the bundle directory. */
export const LAYA_SHARED_ONNX_FILE = 'laya-shared.onnx';
/** Bundle files every shared pins file must name (graph excluded; it is pinned by onnx.sha256). */
export const LAYA_SHARED_REQUIRED_BUNDLE = ['shared_config.json', 'tokenizer/tokenizer.json', 'tokenizer/tokenizer_config.json'] as const;

export interface LayaSharedPins {
  schema: string;
  name: string;
  note?: string;
  checkpoint: { name: string; modelSafetensorsSha256: string; run?: string };
  onnx: { file: string; sha256: string; precision: string; inputs: string[]; outputs: string[]; kMax: number };
  /** Bundle-relative path -> SHA-256 for every non-graph file this evaluator reads. */
  bundle: Record<string, string>;
  inputFormat: '[CLS] response [SEP]';
  maxLen: number;
  /** Output row order of the graph (= shared_config.json qids), and each head's logit width. */
  heads: { order: string[]; widths: number[] };
  /** Question definitions the heads were trained against (provenance; not fed to the model). */
  questions: { file: string; sha256: string };
  stanceQuestion: string;
  stanceOrder: string[];
  temperature: { noul: number; choice: number };
  thresholds: { mode: string; stance: 'argmax'; noul: Record<string, number> };
  composition: { file: string; sha256: string };
  primitiveKinds: { objects: string[]; qualifiers: string[] };
  ort: { allowSpinning: false };
}

export interface LayaSharedLocalEvaluatorOptions {
  taxonomy: Taxonomy;
  /** <bundle>/laya-shared.onnx. The bundle directory also holds shared_config.json and tokenizer/. */
  modelPath: string;
  modelSha256: string;
  pinsPath: string;
  pinsSha256: string;
  compositionPath: string;
  compositionSha256: string;
  intraOpNumThreads?: number;
  /** Skip the warm-up call at the end of load(). Tests only. */
  skipWarmup?: boolean;
}

export interface LayaSharedLastPass {
  logits: LayaLogits;
  primitives: PrimitivesVerdict;
  composed: string[];
  /** Response tokens before the max_len cut. */
  responseTokens: number;
  /** Sequence length fed (with [CLS] and [SEP]). */
  inputTokens: number;
  truncatedTokens: number;
  layout: 'shared';
  /** SHA-256 of the feed (see sharedFeedSha256). Computed on demand, not on the hot path. */
  feedSha256: () => string;
}

const SHA256_HEX = /^[0-9a-f]{64}$/;

/**
 * SHA-256 of the feed: `input_ids:1xL:` then the ids as little-endian int64, the same scheme as the
 * packed Laya feed hash (packedFeedSha256) restricted to the one tensor this graph takes.
 * python_ref_shared.py computes the same bytes from its own feed.
 */
export function sharedFeedSha256(ids: BigInt64Array): string {
  const h = createHash('sha256');
  h.update(`input_ids:1x${ids.length}:`);
  const buf = Buffer.alloc(ids.length * 8);
  ids.forEach((v, i) => buf.writeBigInt64LE(v, i * 8));
  h.update(buf);
  return h.digest('hex');
}

/** Structural checks on a pins file that has already passed its SHA check. */
export function validateLayaSharedPins(pins: LayaSharedPins): void {
  if (pins.schema !== LAYA_SHARED_PINS_SCHEMA) throw new Error(`laya-shared pins schema ${pins.schema} is not ${LAYA_SHARED_PINS_SCHEMA}`);
  if (pins.inputFormat !== '[CLS] response [SEP]') throw new Error('laya-shared pins: inputFormat must be [CLS] response [SEP]');
  if (!(Number.isInteger(pins.maxLen) && pins.maxLen > 2)) throw new Error('laya-shared pins: maxLen must be an integer > 2');
  const { order, widths } = pins.heads;
  if (!Array.isArray(order) || !Array.isArray(widths) || order.length !== widths.length || new Set(order).size !== order.length) {
    throw new Error('laya-shared pins: heads.order and heads.widths must be equal-length, order without duplicates');
  }
  const si = order.indexOf(pins.stanceQuestion);
  if (si < 0 || widths[si] !== pins.stanceOrder.length) throw new Error('laya-shared pins: stance head missing or its width is not stanceOrder.length');
  const noul = order.filter((q) => q !== pins.stanceQuestion);
  if (!noul.every((q) => widths[order.indexOf(q)] === 2)) throw new Error('laya-shared pins: every yes/no head must have width 2');
  if (!widths.every((w) => w <= pins.onnx.kMax)) throw new Error('laya-shared pins: a head width exceeds onnx.kMax');
  const kinds = [...pins.primitiveKinds.objects, ...pins.primitiveKinds.qualifiers];
  if (noul.length !== kinds.length || !kinds.every((q) => noul.includes(q))) {
    throw new Error('laya-shared pins: objects + qualifiers must be exactly the yes/no heads');
  }
  for (const q of kinds) {
    const t = pins.thresholds.noul[q];
    if (typeof t !== 'number' || !(t > 0 && t < 1)) throw new Error(`laya-shared pins: threshold for ${q} must be in (0, 1)`);
  }
  for (const t of [pins.temperature.noul, pins.temperature.choice]) {
    if (typeof t !== 'number' || !(t > 0)) throw new Error('laya-shared pins: temperatures must be positive');
  }
  if (pins.thresholds.stance !== 'argmax') throw new Error('laya-shared pins: stance decision must be argmax');
  if (pins.ort?.allowSpinning !== false) throw new Error('laya-shared pins: ort.allowSpinning must be pinned false');
  for (const f of LAYA_SHARED_REQUIRED_BUNDLE) {
    if (typeof pins.bundle[f] !== 'string' || !SHA256_HEX.test(pins.bundle[f] as string)) throw new Error(`laya-shared pins: bundle.${f} must be pinned by SHA-256`);
  }
}

function verifyPinnedFile(path: string, expected: string, what: string): void {
  const got = sha256FileHex(path);
  if (got !== normalizeDigest(expected)) {
    throw new Error(`laya-shared ${what} digest mismatch for ${basename(path)}: expected ${normalizeDigest(expected)}, got ${got}`);
  }
}

/** Reads and verifies every pin. Throws before any model session exists. */
export function loadLayaSharedPins(
  opts: Pick<LayaSharedLocalEvaluatorOptions, 'modelPath' | 'modelSha256' | 'pinsPath' | 'pinsSha256' | 'compositionPath' | 'compositionSha256'>,
): { pins: LayaSharedPins; composition: Composition; modelDigest: string; pinsDigest: string } {
  if (basename(opts.modelPath) !== LAYA_SHARED_ONNX_FILE) {
    throw new Error(`laya-shared modelPath must name ${LAYA_SHARED_ONNX_FILE} inside the bundle directory (got ${basename(opts.modelPath)})`);
  }
  verifyPinnedFile(opts.pinsPath, opts.pinsSha256, 'pins');
  const pins = JSON.parse(readFileSync(opts.pinsPath, 'utf8')) as LayaSharedPins;
  validateLayaSharedPins(pins);
  if (normalizeDigest(pins.onnx.sha256) !== normalizeDigest(opts.modelSha256)) {
    throw new Error('laya-shared config modelSha256 does not match the pins file onnx.sha256; the pins belong to a different model');
  }
  if (normalizeDigest(pins.composition.sha256) !== normalizeDigest(opts.compositionSha256)) {
    throw new Error('laya-shared config compositionSha256 does not match the pins file composition.sha256');
  }
  verifyPinnedFile(opts.compositionPath, opts.compositionSha256, 'composition');
  const bundleDir = dirname(opts.modelPath);
  for (const [rel, sha] of Object.entries(pins.bundle)) verifyPinnedFile(join(bundleDir, rel), sha, `bundle file ${rel}`);
  const sc = JSON.parse(readFileSync(join(bundleDir, 'shared_config.json'), 'utf8')) as { qids: string[]; widths: number[]; max_len: number; input_format: string };
  if (JSON.stringify(sc.qids) !== JSON.stringify(pins.heads.order) || JSON.stringify(sc.widths) !== JSON.stringify(pins.heads.widths)) {
    throw new Error('laya-shared: shared_config.json qids/widths differ from the pinned head order');
  }
  if (sc.max_len !== pins.maxLen || sc.input_format !== pins.inputFormat) {
    throw new Error(`laya-shared: shared_config.json max_len/input_format ${sc.max_len}/${sc.input_format} != pinned ${pins.maxLen}/${pins.inputFormat}`);
  }
  // Last, because it reads 1.7 GB.
  const modelDigest = verifyModelSha256(opts.modelPath, opts.modelSha256);
  const composition = JSON.parse(readFileSync(opts.compositionPath, 'utf8')) as Composition;
  return { pins, composition, modelDigest, pinsDigest: normalizeDigest(opts.pinsSha256) };
}

type OrtTensor = { data: unknown; dims: readonly number[] };
type OrtSession = { run: (feeds: Record<string, OrtTensor>, fetches?: string[]) => Promise<Record<string, OrtTensor>>; release?: () => Promise<void> };
type HfTokenizer = { encode: (t: string, o: { add_special_tokens: boolean }) => { ids: number[] }; token_to_id: (t: string) => number | undefined };

export class LayaSharedLocalEvaluator implements Evaluator {
  readonly id = 'local-laya-shared';
  readonly version: string;
  readonly pins: LayaSharedPins;
  readonly #taxonomy: Taxonomy;
  readonly #opts: LayaSharedLocalEvaluatorOptions;
  readonly #composition: Composition;
  #session: OrtSession | undefined;
  #Tensor: (new (type: string, data: BigInt64Array, dims: number[]) => OrtTensor) | undefined;
  #tok: HfTokenizer | undefined;
  #special = { cls: 0, sep: 0, maskTok: '[MASK]' };
  #queue: Promise<void> = Promise.resolve();
  #warming = false;

  lastRawByClass: Record<string, string> = {};
  lastThoughtDetected = false;
  lastEvalMs = 0;
  lastPrimitivesVerdict: PrimitivesVerdict | null = null;
  lastPass: LayaSharedLastPass | null = null;
  warmupMs = 0;
  systemInfo = '';

  constructor(opts: LayaSharedLocalEvaluatorOptions) {
    this.#taxonomy = opts.taxonomy;
    this.#opts = opts;
    const { pins, composition, modelDigest, pinsDigest } = loadLayaSharedPins(opts);
    this.pins = pins;
    this.#composition = composition;
    this.version = `${modelDigest.slice(0, 12)}+laya-shared-pins-${pinsDigest.slice(0, 12)}`;
  }

  async load(): Promise<void> {
    if (this.#session) return;
    const started = Date.now();
    const ort = (await import('onnxruntime-node')) as unknown as {
      InferenceSession: { create: (p: string, o: Record<string, unknown>) => Promise<OrtSession> };
      Tensor: new (type: string, data: BigInt64Array, dims: number[]) => OrtTensor;
    };
    const { Tokenizer } = (await import('@huggingface/tokenizers')) as unknown as {
      Tokenizer: new (json: unknown, cfg: unknown) => HfTokenizer;
    };
    const dir = dirname(this.#opts.modelPath);
    const read = (f: string): unknown => JSON.parse(readFileSync(join(dir, f), 'utf8'));
    const tok = new Tokenizer(read('tokenizer/tokenizer.json'), read('tokenizer/tokenizer_config.json'));
    const id = (t: string): number => {
      const v = tok.token_to_id(t);
      if (v === undefined) throw new Error(`laya-shared: special token ${t} missing from tokenizer`);
      return v;
    };
    this.#special = { cls: id('[CLS]'), sep: id('[SEP]'), maskTok: '[MASK]' };
    id('[MASK]');
    const sessionOptions: Record<string, unknown> = {
      executionProviders: ['cpu'],
      graphOptimizationLevel: 'all',
      interOpNumThreads: 1,
      executionMode: 'sequential',
      // Pinned with the model (pins.ort.allowSpinning false): session.intra_op.allow_spinning = "0". Speed only.
      extra: { session: { intra_op: { allow_spinning: '0' } } },
    };
    if (this.#opts.intraOpNumThreads !== undefined) sessionOptions['intraOpNumThreads'] = this.#opts.intraOpNumThreads;
    this.#session = await ort.InferenceSession.create(this.#opts.modelPath, sessionOptions);
    this.#Tensor = ort.Tensor;
    this.#tok = tok;
    console.log(`local-laya-shared@${this.version}: session open (${this.pins.name}) in ${Date.now() - started}ms`);
    if (this.#opts.skipWarmup) return;
    this.#warming = true;
    const warmStart = Date.now();
    try {
      await warmAtLoad({
        evaluate: (req) => this.#evaluateLocked(req),
        observables: this,
        log: (line) => console.log(line),
        warn: (line) => console.warn(line),
        version: this.version,
        template: 'laya-shared-onnx',
        id: this.id,
      });
    } finally {
      this.warmupMs = Date.now() - warmStart;
      this.#warming = false;
      this.lastPass = null;
      this.lastPrimitivesVerdict = null;
    }
  }

  /** Token ids fed for `content` ([CLS] response[:max_len-2] [SEP]) and the uncut response length. */
  encode(content: string): { ids: BigInt64Array; responseTokens: number } {
    const tok = this.#tok;
    if (!tok) throw new Error('laya-shared: tokenizer not loaded');
    const resp = tok.encode(content.split(this.#special.maskTok).join(' '), { add_special_tokens: false }).ids;
    const kept = resp.slice(0, Math.max(0, this.pins.maxLen - 2));
    const ids = new BigInt64Array(kept.length + 2);
    ids[0] = BigInt(this.#special.cls);
    kept.forEach((v, i) => (ids[i + 1] = BigInt(v)));
    ids[kept.length + 1] = BigInt(this.#special.sep);
    return { ids, responseTokens: resp.length };
  }

  /** One forward pass and the pinned decode, plus composition. Used by evaluate() and the cross-path test. */
  async primitives(content: string): Promise<LayaSharedLastPass> {
    await this.load();
    const session = this.#session;
    const Tensor = this.#Tensor;
    if (!session || !Tensor) throw new Error('laya-shared evaluator failed to load');
    const { ids, responseTokens } = this.encode(content);
    const out = await session.run({ input_ids: new Tensor('int64', ids, [1, ids.length]) }, ['logits']);
    const lg = out['logits'];
    if (!lg || !(lg.data instanceof Float32Array)) throw new Error('laya-shared: graph did not return float32 logits');
    const { order, widths } = this.pins.heads;
    const [b = 0, rows = 0, k = 0] = lg.dims;
    if (b !== 1 || rows !== order.length || k !== this.pins.onnx.kMax) throw new Error(`laya-shared: logits dims ${lg.dims.join('x')} != 1x${order.length}x${this.pins.onnx.kMax}`);
    const data = lg.data;
    const logits: LayaLogits = {};
    order.forEach((q, r) => (logits[q] = Array.from(data.subarray(r * k, r * k + (widths[r] as number)))));
    const decoded = layaPrimitivesFromLogits(logits, this.pins);
    const primitives = { stance: decoded.stance, objects: decoded.objects, qualifiers: decoded.qualifiers };
    return {
      logits,
      primitives,
      composed: composePrimitives(primitives, this.#composition),
      responseTokens,
      inputTokens: ids.length,
      truncatedTokens: Math.max(0, responseTokens - (this.pins.maxLen - 2)),
      layout: 'shared',
      feedSha256: () => sharedFeedSha256(ids),
    };
  }

  async evaluate(req: EvaluationRequest): Promise<Flag[]> {
    const previous = this.#queue;
    let release: () => void = () => undefined;
    this.#queue = new Promise<void>((resolve) => (release = resolve));
    await previous;
    try {
      return await this.#evaluateLocked(req);
    } finally {
      release();
    }
  }

  async #evaluateLocked(req: EvaluationRequest): Promise<Flag[]> {
    const started = Date.now();
    this.lastRawByClass = {};
    this.lastThoughtDetected = false;
    const pass = await this.primitives(req.content);
    this.lastPass = pass;
    this.lastPrimitivesVerdict = pass.primitives;
    const byType = new Map(this.#taxonomy.flags.map((def) => [def.type, def]));
    const flags: Flag[] = [];
    for (const type of pass.composed) {
      const def = byType.get(type);
      if (!def) continue;
      this.lastRawByClass[type] = 'yes';
      flags.push({ type: def.type, severity: def.severity, evidence: [], basis: `${this.#taxonomy.version}:local-laya-shared:${def.type}` });
    }
    this.lastEvalMs = Date.now() - started;
    if (!this.#warming) {
      const p = pass.primitives;
      console.log(
        `local-laya-shared@${this.version}: (${p.stance}; ${p.objects.join(',') || '-'}; ${p.qualifiers.join(',') || '-'}) -> ${pass.composed.join(',') || 'none'} in ${this.lastEvalMs}ms`,
      );
    }
    return flags;
  }

  async close(): Promise<void> {
    await this.#session?.release?.();
    this.#session = undefined;
  }
}

/** Host entry for engine 'laya-shared-onnx'. Verifies every pin, opens the session, warms up. */
export async function createLayaSharedLocalEvaluator(cfg: LocalEvaluatorConfig, taxonomy: Taxonomy): Promise<LayaSharedLocalEvaluator> {
  if (cfg.engine !== 'laya-shared-onnx' || !cfg.laya) {
    throw new Error('createLayaSharedLocalEvaluator needs engine laya-shared-onnx and a laya block');
  }
  const opts: LayaSharedLocalEvaluatorOptions = {
    taxonomy,
    modelPath: cfg.modelPath,
    modelSha256: cfg.modelSha256,
    pinsPath: cfg.laya.pinsPath,
    pinsSha256: cfg.laya.pinsSha256,
    compositionPath: cfg.laya.compositionPath,
    compositionSha256: cfg.laya.compositionSha256,
  };
  if (cfg.laya.intraOpNumThreads !== undefined) opts.intraOpNumThreads = cfg.laya.intraOpNumThreads;
  const evaluator = new LayaSharedLocalEvaluator(opts);
  await evaluator.load();
  return evaluator;
}

export { LOAD_WARMUP_REQUEST };
