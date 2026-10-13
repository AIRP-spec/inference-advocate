// Laya primitives evaluator: @receptron/laya on ONNX Runtime, composed through the shared compose.
//
// Paper: step 8. Provisional: Sections 3.3 and 3.4 (reproducible verdicts, on-device tier).
// Off by default. It runs only when an evaluator config sets kind 'local' and engine
// 'laya-onnx'. With no config the host keeps the rule evaluator; with a config that omits
// `engine` the host keeps the GGUF live pin.
//
// What is pinned, and refused on mismatch, before any session opens:
//   - the ONNX graph (modelSha256), checked against the pins file as well as the config;
//   - the pins file itself (laya.pinsSha256): temperature, thresholds, stance order, question
//     wording, max_len / head_max_len, and the SHAs of laya_config.json and the tokenizer files;
//   - the composition (laya.compositionSha256), which must also equal the pins file's.
//
// Two feed layouts, chosen by the pins file (`layout`), both one forward pass per response:
//   padded (default, the original pins): @receptron/laya's systemOne builds the 17 question-conditioned
//     rows (laya build_sequence layout), pads them into one batch, and runs the session once.
//   packed (laya-5766-fp32-packed pins): the same 17 rows, bin-packed without padding (laya-packed.ts,
//     a port of decide/adopt/cpu-speed pack_common.py) and run once through the packed graph, with
//     ORT intra-op spinning off. Same verdicts as padded (0 disagreements on 471 items, Python side).
// Decisions are taken from that pass's raw logits, not from systemOne's answers, because
// systemOne rounds probabilities to four decimals and a rounded P(true) of 0.49996 would read
// as 0.5 and fire where the Python gate path did not. The decode is layaPrimitivesFromLogits,
// the same function the cross-path test applies to the Python path's logits.

import { readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import type { EvaluationRequest, Evaluator, Flag, LocalEvaluatorConfig, Taxonomy } from '@airp/core';
import { sha256FileHex, verifyModelSha256, normalizeDigest } from './digest.js';
import { compose as composePrimitives, type Composition, type PrimitivesVerdict } from './compose-primitives.js';
import { LOAD_WARMUP_REQUEST, warmAtLoad } from './local-evaluator.js';
import {
  QTYPES,
  buildQuestionPrefix,
  completeSequence,
  packRows,
  packedFeedArrays,
  packedFeedSha256,
  renderOptions,
  toInternal,
  type InternalQuestion,
  type LayaTokenIds,
  type PackRow,
} from './laya-packed.js';

export const LAYA_PINS_SCHEMA = 'airp-laya-pins/1';
/** @receptron/laya expects this file name inside its bundle directory. */
export const LAYA_ONNX_FILE = 'laya.onnx';

export interface LayaQuestion {
  type: 'noul' | 'choice';
  instructions: string;
  criteria?: Record<string, string>;
}

export interface LayaPins {
  schema: string;
  name: string;
  checkpoint: { name: string; modelSafetensorsSha256: string };
  onnx: { file: string; sha256: string; precision: string };
  /** Bundle-relative path -> SHA-256 for every non-graph file @receptron/laya reads. */
  bundle: Record<string, string>;
  maxLen: number;
  headMaxLen: number;
  questions: { file: string; sha256: string; order: string[]; definitions: Record<string, LayaQuestion> };
  stanceQuestion: string;
  stanceOrder: string[];
  temperature: { noul: number; choice: number };
  thresholds: { mode: string; stance: 'argmax'; noul: Record<string, number> };
  composition: { file: string; sha256: string };
  primitiveKinds: { objects: string[]; qualifiers: string[] };
  /** Absent = padded (receptron systemOne). */
  layout?: LayaLayoutPin;
  /** ORT session settings pinned with the model: they change speed, never verdicts. */
  ort?: { allowSpinning?: boolean };
}

export interface LayaLayoutPin {
  kind: 'padded' | 'packed';
  /** packed only: how the bin capacity is chosen. */
  packCap?: 'max' | 'costmin';
  costA?: number;
  costB?: number;
  /** SHA-256 of the Python pack_common.py this layout is a port of (provenance, checked in CI). */
  packCommonSha256?: string;
}

export interface LayaLocalEvaluatorOptions {
  taxonomy: Taxonomy;
  /** <bundle>/laya.onnx. The bundle directory also holds laya_config.json and tokenizer/. */
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

/** Raw head logits for one response, option order as the pins define (noul: [false, true]). */
export type LayaLogits = Record<string, number[]>;

function softmax(z: number[], temperature: number): number[] {
  const s = z.map((v) => v / temperature);
  const m = Math.max(...s);
  const e = s.map((v) => Math.exp(v - m));
  const sum = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / sum);
}

/**
 * Pinned decode: temperature-scaled softmax over each question's raw logits, P(true) >= the
 * pinned threshold for yes/no primitives, argmax (first maximum in pinned order) for stance.
 * Object and qualifier lists are in the pinned order. This is the only decode the Node path has.
 */
export function layaPrimitivesFromLogits(logits: LayaLogits, pins: LayaPins): PrimitivesVerdict & {
  pTrue: Record<string, number>;
  stanceProbs: Record<string, number>;
} {
  const stanceLogits = logits[pins.stanceQuestion];
  if (!stanceLogits || stanceLogits.length !== pins.stanceOrder.length) {
    throw new Error(`laya: stance logits missing or wrong width (${stanceLogits?.length})`);
  }
  const sp = softmax(stanceLogits, pins.temperature.choice);
  let best = 0;
  for (let i = 1; i < sp.length; i++) if ((sp[i] as number) > (sp[best] as number)) best = i;
  const stanceProbs = Object.fromEntries(pins.stanceOrder.map((k, i) => [k, sp[i] as number]));
  const pTrue: Record<string, number> = {};
  for (const q of [...pins.primitiveKinds.objects, ...pins.primitiveKinds.qualifiers]) {
    const z = logits[q];
    if (!z || z.length !== 2) throw new Error(`laya: logits for ${q} missing or not two-way`);
    pTrue[q] = softmax(z, pins.temperature.noul)[1] as number;
  }
  const fired = (q: string): boolean => {
    const thr = pins.thresholds.noul[q];
    if (typeof thr !== 'number') throw new Error(`laya: no pinned threshold for ${q}`);
    return (pTrue[q] as number) >= thr;
  };
  return {
    stance: pins.stanceOrder[best] as string,
    objects: pins.primitiveKinds.objects.filter(fired),
    qualifiers: pins.primitiveKinds.qualifiers.filter(fired),
    pTrue,
    stanceProbs,
  };
}

/** Structural checks on a pins file that has already passed its SHA check. */
export function validateLayaPins(pins: LayaPins): void {
  if (pins.schema !== LAYA_PINS_SCHEMA) throw new Error(`laya pins schema ${pins.schema} is not ${LAYA_PINS_SCHEMA}`);
  const defs = pins.questions.definitions;
  const order = pins.questions.order;
  if (JSON.stringify(Object.keys(defs)) !== JSON.stringify(order)) {
    throw new Error('laya pins: question definitions are not in the pinned order');
  }
  const stance = defs[pins.stanceQuestion];
  if (!stance || stance.type !== 'choice' || JSON.stringify(Object.keys(stance.criteria ?? {})) !== JSON.stringify(pins.stanceOrder)) {
    throw new Error('laya pins: stance question does not match stanceOrder');
  }
  const noul = order.filter((q) => defs[q]?.type === 'noul');
  const kinds = [...pins.primitiveKinds.objects, ...pins.primitiveKinds.qualifiers];
  if (noul.length !== kinds.length || !kinds.every((q) => noul.includes(q))) {
    throw new Error('laya pins: objects + qualifiers must be exactly the yes/no questions');
  }
  for (const q of kinds) {
    const t = pins.thresholds.noul[q];
    if (typeof t !== 'number' || !(t > 0 && t < 1)) throw new Error(`laya pins: threshold for ${q} must be in (0, 1)`);
  }
  for (const t of [pins.temperature.noul, pins.temperature.choice]) {
    if (typeof t !== 'number' || !(t > 0)) throw new Error('laya pins: temperatures must be positive');
  }
  if (pins.thresholds.stance !== 'argmax') throw new Error('laya pins: stance decision must be argmax');
  const lay = pins.layout;
  if (lay !== undefined) {
    if (lay.kind !== 'padded' && lay.kind !== 'packed') throw new Error(`laya pins: unknown layout ${String(lay.kind)}`);
    if (lay.kind === 'packed') {
      if (lay.packCap !== 'max' && lay.packCap !== 'costmin') throw new Error('laya pins: packed layout needs packCap max|costmin');
      if (lay.packCap === 'costmin' && !(typeof lay.costA === 'number' && typeof lay.costB === 'number' && lay.costA > 0 && lay.costB >= 0)) {
        throw new Error('laya pins: costmin packing needs positive costA and costB');
      }
    }
  }
}

function verifyPinnedFile(path: string, expected: string, what: string): void {
  const got = sha256FileHex(path);
  if (got !== normalizeDigest(expected)) {
    throw new Error(`laya ${what} digest mismatch for ${basename(path)}: expected ${normalizeDigest(expected)}, got ${got}`);
  }
}

/** Reads and verifies every pin. Throws before any model session exists. */
export function loadLayaPins(opts: Pick<LayaLocalEvaluatorOptions, 'modelPath' | 'modelSha256' | 'pinsPath' | 'pinsSha256' | 'compositionPath' | 'compositionSha256'>): {
  pins: LayaPins;
  composition: Composition;
  modelDigest: string;
  pinsDigest: string;
} {
  if (basename(opts.modelPath) !== LAYA_ONNX_FILE) {
    throw new Error(`laya modelPath must name ${LAYA_ONNX_FILE} inside the bundle directory (got ${basename(opts.modelPath)})`);
  }
  verifyPinnedFile(opts.pinsPath, opts.pinsSha256, 'pins');
  const pins = JSON.parse(readFileSync(opts.pinsPath, 'utf8')) as LayaPins;
  validateLayaPins(pins);
  if (normalizeDigest(pins.onnx.sha256) !== normalizeDigest(opts.modelSha256)) {
    throw new Error('laya config modelSha256 does not match the pins file onnx.sha256; the pins belong to a different model');
  }
  if (normalizeDigest(pins.composition.sha256) !== normalizeDigest(opts.compositionSha256)) {
    throw new Error('laya config compositionSha256 does not match the pins file composition.sha256');
  }
  verifyPinnedFile(opts.compositionPath, opts.compositionSha256, 'composition');
  const bundleDir = dirname(opts.modelPath);
  for (const [rel, sha] of Object.entries(pins.bundle)) verifyPinnedFile(join(bundleDir, rel), sha, `bundle file ${rel}`);
  const cfg = JSON.parse(readFileSync(join(bundleDir, 'laya_config.json'), 'utf8')) as { max_len: number; head_max_len: number };
  if (cfg.max_len !== pins.maxLen || cfg.head_max_len !== pins.headMaxLen) {
    throw new Error(`laya_config.json max_len/head_max_len ${cfg.max_len}/${cfg.head_max_len} != pinned ${pins.maxLen}/${pins.headMaxLen}`);
  }
  // Last, because it reads 1.7 GB.
  const modelDigest = verifyModelSha256(opts.modelPath, opts.modelSha256);
  const composition = JSON.parse(readFileSync(opts.compositionPath, 'utf8')) as Composition;
  return { pins, composition, modelDigest, pinsDigest: normalizeDigest(opts.pinsSha256) };
}

type OrtTensor = { data: unknown; dims: readonly number[] };
type RawRun = (feeds: Record<string, OrtTensor>, fetches?: unknown) => Promise<Record<string, OrtTensor>>;
type LayaInstance = {
  session: { run: (feeds: Record<string, OrtTensor>, fetches?: unknown, opts?: unknown) => Promise<Record<string, OrtTensor>> };
  systemOne: (state: string, questions: Record<string, LayaQuestion>) => Promise<{ answers: Record<string, { choice?: string }>; usage: { input_tokens: number } }>;
  close: () => Promise<void>;
};

export interface LayaLastPass {
  logits: LayaLogits;
  primitives: PrimitivesVerdict;
  composed: string[];
  inputTokens: number;
  batchRows: number;
  /** padded: the padded sequence length; packed: the bin capacity. */
  paddedLength: number;
  layout: 'padded' | 'packed';
  /** packed only: number of bins fed. */
  bins?: number;
  /** packed only: SHA-256 of the feed tensors (see packedFeedSha256). Computed on demand, not on the hot path. */
  feedSha256?: () => string;
}

interface PackedPrep {
  encode: (text: string) => number[];
  ids: LayaTokenIds;
  prefixes: Array<{ prefix: number[]; markers: number[] }>;
  qtypes: number[];
}

export class LayaLocalEvaluator implements Evaluator {
  readonly id = 'local-laya';
  readonly version: string;
  readonly pins: LayaPins;
  readonly #taxonomy: Taxonomy;
  readonly #opts: LayaLocalEvaluatorOptions;
  readonly #composition: Composition;
  #laya: LayaInstance | undefined;
  #lastRun: { logits: Float32Array; dims: readonly number[]; paddedLength: number } | undefined;
  #queue: Promise<void> = Promise.resolve();
  #warming = false;
  #rawRun: RawRun | undefined;
  #ort: { Tensor: new (type: string, data: Float32Array | BigInt64Array | Uint8Array, dims: number[]) => OrtTensor } | undefined;
  #packed: PackedPrep | undefined;

  /** Same observables as LocalEvaluator, so warmAtLoad can restore them. */
  lastRawByClass: Record<string, string> = {};
  lastThoughtDetected = false;
  lastEvalMs = 0;
  lastPrimitivesVerdict: PrimitivesVerdict | null = null;
  lastPass: LayaLastPass | null = null;
  /** Wall time of the warm-up call that ended load(), ms. */
  warmupMs = 0;
  systemInfo = '';

  constructor(opts: LayaLocalEvaluatorOptions) {
    this.#taxonomy = opts.taxonomy;
    this.#opts = opts;
    const { pins, composition, modelDigest, pinsDigest } = loadLayaPins(opts);
    this.pins = pins;
    this.#composition = composition;
    this.version = `${modelDigest.slice(0, 12)}+laya-pins-${pinsDigest.slice(0, 12)}`;
  }

  async load(): Promise<void> {
    if (this.#laya) return;
    const started = Date.now();
    const { Laya } = (await import('@receptron/laya')) as unknown as {
      Laya: { load: (o: Record<string, unknown>) => Promise<LayaInstance> };
    };
    const ort = (await import('onnxruntime-node')) as unknown as {
      Tensor: new (type: string, data: Float32Array | BigInt64Array | Uint8Array, dims: number[]) => OrtTensor;
      env?: { versions?: Record<string, string> };
    };
    const sessionOptions: Record<string, unknown> = { interOpNumThreads: 1, executionMode: 'sequential' };
    if (this.#opts.intraOpNumThreads !== undefined) sessionOptions['intraOpNumThreads'] = this.#opts.intraOpNumThreads;
    // Pinned with the model: ORT intra-op spinning off (session.intra_op.allow_spinning = "0"). Speed only.
    if (this.pins.ort?.allowSpinning === false) sessionOptions['extra'] = { session: { intra_op: { allow_spinning: '0' } } };
    const laya = await Laya.load({ modelDir: dirname(this.#opts.modelPath), executionProviders: ['cpu'], sessionOptions });
    // The pinned graph names its second output act_logits; @receptron/laya reads act_probs. Adapt
    // that one name, and keep this pass's raw logits for the pinned decode. Nothing else changes:
    // feeds, the batch, and the logits tensor reach the caller as the session produced them.
    const session = laya.session;
    const run = session.run.bind(session);
    this.#rawRun = run as unknown as RawRun;
    this.#ort = ort;
    session.run = async (feeds) => {
      const out = await run(feeds, ['logits', 'act_logits']);
      const logits = out['logits'];
      const act = out['act_logits'];
      if (!logits || !(logits.data instanceof Float32Array) || !act || !(act.data instanceof Float32Array)) {
        throw new Error('laya: pinned graph did not return float32 logits and act_logits');
      }
      const [n = 0, c = 0] = act.dims;
      const probs = new Float32Array(n * c);
      for (let i = 0; i < n; i++) {
        const row = Array.from(act.data.subarray(i * c, (i + 1) * c));
        softmax(row, 1).forEach((p, j) => (probs[i * c + j] = p));
      }
      const ids = feeds['input_ids'];
      this.#lastRun = { logits: logits.data, dims: logits.dims, paddedLength: ids?.dims[1] ?? 0 };
      return { logits, act_probs: new ort.Tensor('float32', probs, [n, c]) };
    };
    this.#laya = laya;
    if (this.pins.layout?.kind === 'packed') this.#packed = this.#preparePacked(laya);
    this.systemInfo = `onnxruntime-node ${ort.env?.versions?.['node'] ?? ''}`.trim();
    console.log(`local-laya@${this.version}: session open (${this.pins.name}) in ${Date.now() - started}ms`);
    if (this.#opts.skipWarmup) return;
    // Warm-up at the end of load(): the first session.run allocates and plans the graph.
    this.#warming = true;
    const warmStart = Date.now();
    try {
      await warmAtLoad({
        evaluate: (req) => this.#evaluateLocked(req),
        observables: this,
        log: (line) => console.log(line),
        warn: (line) => console.warn(line),
        version: this.version,
        template: 'laya-onnx',
        id: this.id,
      });
    } finally {
      this.warmupMs = Date.now() - warmStart;
      this.#warming = false;
      this.lastPass = null;
      this.lastPrimitivesVerdict = null;
    }
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

  /** One forward pass and the pinned decode, without composition. Used by the cross-path test. */
  async primitives(content: string): Promise<LayaLastPass> {
    await this.load();
    const laya = this.#laya;
    if (!laya) throw new Error('laya evaluator failed to load');
    const defs = this.pins.questions.definitions;
    this.#lastRun = undefined;
    let inputTokens: number;
    let packedInfo: { bins: number; feedSha256: () => string } | undefined;
    if (this.#packed) {
      const r = await this.#runPacked(content, this.#packed);
      inputTokens = r.inputTokens;
      packedInfo = { bins: r.bins, feedSha256: r.feedSha256 };
    } else {
      const res = await laya.systemOne(content, defs);
      inputTokens = res.usage.input_tokens;
    }
    const run = this.#lastRun as { logits: Float32Array; dims: readonly number[]; paddedLength: number } | undefined;
    if (!run) throw new Error('laya: the session did not run');
    const order = this.pins.questions.order;
    const [rows = 0, k = 0] = run.dims;
    if (rows !== order.length) throw new Error(`laya: ${rows} rows for ${order.length} questions`);
    const logits: LayaLogits = {};
    order.forEach((q, r) => {
      const width = q === this.pins.stanceQuestion ? this.pins.stanceOrder.length : 2;
      logits[q] = Array.from(run.logits.subarray(r * k, r * k + width));
    });
    const decoded = layaPrimitivesFromLogits(logits, this.pins);
    const primitives = { stance: decoded.stance, objects: decoded.objects, qualifiers: decoded.qualifiers };
    return {
      logits,
      primitives,
      composed: composePrimitives(primitives, this.#composition),
      inputTokens,
      batchRows: rows,
      paddedLength: run.paddedLength,
      layout: packedInfo ? 'packed' : 'padded',
      ...(packedInfo ? { bins: packedInfo.bins, feedSha256: packedInfo.feedSha256 } : {}),
    };
  }

  /**
   * Packed layout: tokenizer, special ids and the fixed per-question prefixes. The tokenizer is
   * @receptron/laya's own (the instance's `encode` and `ids`, the objects its systemOne uses), so
   * token ids are the same function as on the padded path.
   */
  #preparePacked(laya: LayaInstance): PackedPrep {
    const inner = laya as unknown as { encode?: (t: string) => number[]; ids?: LayaTokenIds; config?: { max_len: number; head_max_len: number } };
    if (typeof inner.encode !== 'function' || !inner.ids) {
      throw new Error('laya: @receptron/laya no longer exposes encode/ids; the packed layout needs them (pinned to 0.1.2)');
    }
    const defs = this.pins.questions.definitions;
    const iq = this.pins.questions.order.map((q) => toInternal(defs[q] as LayaQuestion));
    const prefixes = iq.map((q: InternalQuestion) => {
      const p = buildQuestionPrefix(inner.encode as (t: string) => number[], inner.ids as LayaTokenIds, q, this.pins.headMaxLen);
      if (p.markers.length !== renderOptions(q).length) throw new Error('laya: question options do not fit in head_max_len');
      return p;
    });
    return { encode: inner.encode, ids: inner.ids, prefixes, qtypes: iq.map((q) => QTYPES[q.t] as number) };
  }

  async #runPacked(content: string, prep: PackedPrep): Promise<{ inputTokens: number; bins: number; feedSha256: () => string }> {
    const lay = this.pins.layout as LayaLayoutPin;
    const ort = this.#ort;
    const run = this.#rawRun;
    if (!ort || !run) throw new Error('laya: session not open');
    const state = prep.encode(content.split(prep.ids.maskTok).join(' '));
    const rows: PackRow[] = prep.prefixes.map((p, i) => {
      const seq = completeSequence(p, state, prep.ids.sep, this.pins.maxLen);
      return { ids: seq.ids, markers: seq.markers, qtype: prep.qtypes[i] as number };
    });
    const feed = packRows(rows, prep.ids.pad, lay.packCap ?? 'costmin', lay.costA, lay.costB);
    const feeds: Record<string, OrtTensor> = {};
    for (const a of packedFeedArrays(feed)) feeds[a.name] = new ort.Tensor(a.type, a.data, a.dims) as unknown as OrtTensor;
    const out = await run(feeds, ['logits']);
    const logits = out['logits'];
    if (!logits || !(logits.data instanceof Float32Array)) throw new Error('laya: packed graph did not return float32 logits');
    this.#lastRun = { logits: logits.data, dims: logits.dims, paddedLength: feed.cap };
    return { inputTokens: rows.reduce((s, r) => s + r.ids.length, 0), bins: feed.bins, feedSha256: () => packedFeedSha256(feed) };
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
      flags.push({ type: def.type, severity: def.severity, evidence: [], basis: `${this.#taxonomy.version}:local-laya:${def.type}` });
    }
    this.lastEvalMs = Date.now() - started;
    if (!this.#warming) {
      const p = pass.primitives;
      console.log(
        `local-laya@${this.version}: (${p.stance}; ${p.objects.join(',') || '-'}; ${p.qualifiers.join(',') || '-'}) -> ${pass.composed.join(',') || 'none'} in ${this.lastEvalMs}ms`,
      );
    }
    return flags;
  }

  async close(): Promise<void> {
    await this.#laya?.close();
    this.#laya = undefined;
  }
}

/** Host entry for engine 'laya-onnx'. Verifies every pin, opens the session, warms up. */
export async function createLayaLocalEvaluator(cfg: LocalEvaluatorConfig, taxonomy: Taxonomy): Promise<LayaLocalEvaluator> {
  if (cfg.engine !== 'laya-onnx' || !cfg.laya) {
    throw new Error('createLayaLocalEvaluator needs engine laya-onnx and a laya block');
  }
  const opts: LayaLocalEvaluatorOptions = {
    taxonomy,
    modelPath: cfg.modelPath,
    modelSha256: cfg.modelSha256,
    pinsPath: cfg.laya.pinsPath,
    pinsSha256: cfg.laya.pinsSha256,
    compositionPath: cfg.laya.compositionPath,
    compositionSha256: cfg.laya.compositionSha256,
  };
  if (cfg.laya.intraOpNumThreads !== undefined) opts.intraOpNumThreads = cfg.laya.intraOpNumThreads;
  const evaluator = new LayaLocalEvaluator(opts);
  await evaluator.load();
  return evaluator;
}

export { LOAD_WARMUP_REQUEST };
