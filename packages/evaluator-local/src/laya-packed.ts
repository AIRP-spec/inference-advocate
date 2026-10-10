// Packed (padding-free) feed for the Laya ONNX graph, and the sequence builder it needs.
//
// Task 3 of the Laya adoption follow-up ported to Node. This is a line-for-line port of two
// Python files that are pinned by SHA in the pins file (layout.packCommonSha256):
//   - decide/adopt/cpu-speed/scripts/pack_common.py: choose_cap, _ffd_bins, pack_rows
//   - laya/common.py build_sequence (via @receptron/laya 0.1.2 dist/sequence.js, MIT), with one
//     difference of cost only: the response is tokenized once, and each question's fixed prefix
//     (head + options) is built once at load. The ids and marker positions are the same function of
//     (question, response); the cross-path test hashes the whole packed feed to prove it.
//
// What "packed" means (see decide/adopt/CPU-SPEED.md): the 17 question rows are not padded to the
// longest row. They are bin-packed first-fit-decreasing into B bins of capacity `cap`; attention is
// masked block-diagonally per segment inside the graph, and position ids restart at 0 per segment,
// so every token sees the same context as in the padded layout. Still one session.run.
//
// Feed (all int64 except marker_mask = bool):
//   input_ids, seg_ids, position_ids : [B, cap]   (seg -1 = pad)
//   marker_pos : [rows, k] flat index b*cap + offset + marker;  marker_mask : [rows, k]
//   row_start  : [rows] flat index of each row's [CLS];          qtype : [rows]
//
// Floating point: the cost-minimising cap uses the same IEEE-754 double expressions, in the same
// order, as Python: (A*bins)*k + ((B*bins)*k)*k, ties to the smallest k.

import { createHash } from 'node:crypto';

export const QTYPES: Record<string, number> = { choice: 0, score: 1, noul: 2 };

export interface LayaTokenIds {
  cls: number;
  sep: number;
  mask: number;
  pad: number;
  maskTok: string;
}

export interface InternalQuestion {
  t: 'noul' | 'choice' | 'score';
  ins: string;
  crit: Record<string, string | null> | string[] | undefined;
}

export interface PackRow {
  ids: number[];
  markers: number[];
  qtype: number;
}

export interface PackedFeed {
  bins: number;
  cap: number;
  rows: number;
  k: number;
  inputIds: BigInt64Array;
  segIds: BigInt64Array;
  positionIds: BigInt64Array;
  markerPos: BigInt64Array;
  markerMask: Uint8Array;
  rowStart: BigInt64Array;
  qtype: BigInt64Array;
}

/** RLAgent._to_internal (choice criteria given as a list become a dict of nulls). */
export function toInternal(q: { type: string; instructions: unknown; criteria?: unknown }): InternalQuestion {
  let crit = q.criteria as InternalQuestion['crit'];
  if (q.type === 'choice' && Array.isArray(crit)) crit = Object.fromEntries((crit as string[]).map((c) => [c, null]));
  return { t: q.type as InternalQuestion['t'], ins: typeof q.instructions === 'string' ? q.instructions : JSON.stringify(q.instructions), crit };
}

/** Option texts in label-index order. noul is always [false, true]. */
export function renderOptions(q: InternalQuestion): string[] {
  if (q.t === 'choice') {
    return Object.entries(q.crit as Record<string, string | null>).map(([k, v]) => (v ? `${k}: ${v}` : k));
  }
  if (q.t === 'score') return (q.crit as string[]).map((c, i) => `level ${i}: ${c}`);
  const c = (q.crit ?? {}) as { false?: string; true?: string };
  return ['false: ' + (c.false || 'no, the statement does not hold'), 'true: ' + (c.true || 'yes, the statement holds')];
}

/**
 * Fixed part of a question's sequence: [CLS] <type> question: instructions [SEP] [MASK] opt0 ... [SEP].
 * Same as receptron buildSequence up to and including the first closing [SEP]; independent of the response.
 */
export function buildQuestionPrefix(
  encode: (t: string) => number[],
  ids: LayaTokenIds,
  q: InternalQuestion,
  headMaxLen: number,
): { prefix: number[]; markers: number[] } {
  const scrub = (s: string): string => s.split(ids.maskTok).join(' ');
  const opts = renderOptions(q);
  let headIds = encode(`${q.t} question: ${scrub(q.ins)}`);
  let optIds = opts.map((o) => [ids.mask, ...encode(' ' + scrub(o)).slice(0, 48)]);
  const total = (xs: number[][]): number => xs.reduce((s, o) => s + o.length, 0);
  let optBudget = headMaxLen - total(optIds);
  if (optBudget < 16) {
    const per = Math.max(4, Math.floor((headMaxLen - 16) / Math.max(1, optIds.length)));
    optIds = optIds.map((o) => o.slice(0, per));
    optBudget = headMaxLen - total(optIds);
  }
  headIds = headIds.slice(0, Math.max(8, optBudget));
  const seq = [ids.cls, ...headIds, ids.sep];
  const markers: number[] = [];
  for (const o of optIds) {
    markers.push(seq.length);
    seq.push(...o);
  }
  seq.push(ids.sep);
  return { prefix: seq, markers };
}

/** Appends the response: same truncation as buildSequence (room = maxLen - len(prefix) - 1). */
export function completeSequence(
  prefix: { prefix: number[]; markers: number[] },
  stateIds: number[],
  sepId: number,
  maxLen: number,
): { ids: number[]; markers: number[] } {
  const room = Math.max(0, maxLen - prefix.prefix.length - 1);
  const seq = [...prefix.prefix, ...stateIds.slice(0, room), sepId];
  return { ids: seq.slice(0, maxLen), markers: prefix.markers.filter((m) => m < maxLen) };
}

// S2c cost model, ms ~ A*bins*cap + B*bins*cap^2 (least squares on S2 per-item VPS timings, R^2 0.95).
// The pins file carries the same two numbers; these are the defaults and are checked against it.
export const COST_A = 0.854;
export const COST_B = 0.001606;

function ffdBins(lens: number[], cap: number): number {
  const sorted = [...lens].sort((a, b) => b - a);
  const fill: number[] = [];
  for (const l of sorted) {
    let placed = false;
    for (let b = 0; b < fill.length; b++) {
      if ((fill[b] as number) + l <= cap) {
        fill[b] = (fill[b] as number) + l;
        placed = true;
        break;
      }
    }
    if (!placed) fill.push(l);
  }
  return fill.length;
}

export function chooseCap(lens: number[], mode: 'max' | 'costmin', costA = COST_A, costB = COST_B): number {
  const m = Math.max(...lens);
  if (mode === 'max') return m;
  let best = m;
  let bestCost = Infinity;
  for (let k = m; k <= 2 * m; k++) {
    const bins = ffdBins(lens, k);
    const cost = costA * bins * k + costB * bins * k * k;
    if (cost < bestCost) {
      bestCost = cost;
      best = k;
    }
  }
  return best;
}

export function packRows(rows: PackRow[], padId: number, mode: 'max' | 'costmin', costA = COST_A, costB = COST_B): PackedFeed {
  const n = rows.length;
  const lens = rows.map((r) => r.ids.length);
  const cap = chooseCap(lens, mode, costA, costB);
  const order = [...Array(n).keys()].sort((a, b) => (lens[b] as number) - (lens[a] as number) || a - b);
  const bins: number[][] = [];
  const fill: number[] = [];
  for (const i of order) {
    let placed = false;
    for (let b = 0; b < bins.length; b++) {
      if ((fill[b] as number) + (lens[i] as number) <= cap) {
        (bins[b] as number[]).push(i);
        fill[b] = (fill[b] as number) + (lens[i] as number);
        placed = true;
        break;
      }
    }
    if (!placed) {
      bins.push([i]);
      fill.push(lens[i] as number);
    }
  }
  const B = bins.length;
  const L = cap;
  const k = Math.max(...rows.map((r) => r.markers.length));
  const inputIds = new BigInt64Array(B * L).fill(BigInt(padId));
  const segIds = new BigInt64Array(B * L).fill(-1n);
  const positionIds = new BigInt64Array(B * L);
  const markerPos = new BigInt64Array(n * k);
  const markerMask = new Uint8Array(n * k);
  const rowStart = new BigInt64Array(n);
  bins.forEach((members, b) => {
    let off = 0;
    for (const i of members) {
      const row = rows[i] as PackRow;
      const l = row.ids.length;
      for (let j = 0; j < l; j++) {
        inputIds[b * L + off + j] = BigInt(row.ids[j] as number);
        segIds[b * L + off + j] = BigInt(i);
        positionIds[b * L + off + j] = BigInt(j);
      }
      row.markers.forEach((m, j) => {
        markerPos[i * k + j] = BigInt(b * L + off + m);
        markerMask[i * k + j] = 1;
      });
      rowStart[i] = BigInt(b * L + off);
      off += l;
    }
    for (let j = 0; off + j < L; j++) positionIds[b * L + off + j] = BigInt(j);
  });
  const qtype = BigInt64Array.from(rows.map((r) => BigInt(r.qtype)));
  return { bins: B, cap: L, rows: n, k, inputIds, segIds, positionIds, markerPos, markerMask, rowStart, qtype };
}

/** The ONNX feed names, in the order the graph (and the hash) use. */
export const PACKED_INPUT_NAMES = ['input_ids', 'seg_ids', 'position_ids', 'marker_pos', 'marker_mask', 'row_start', 'qtype'] as const;

export function packedFeedArrays(f: PackedFeed): Array<{ name: string; dims: number[]; data: BigInt64Array | Uint8Array; type: 'int64' | 'bool' }> {
  return [
    { name: 'input_ids', dims: [f.bins, f.cap], data: f.inputIds, type: 'int64' },
    { name: 'seg_ids', dims: [f.bins, f.cap], data: f.segIds, type: 'int64' },
    { name: 'position_ids', dims: [f.bins, f.cap], data: f.positionIds, type: 'int64' },
    { name: 'marker_pos', dims: [f.rows, f.k], data: f.markerPos, type: 'int64' },
    { name: 'marker_mask', dims: [f.rows, f.k], data: f.markerMask, type: 'bool' },
    { name: 'row_start', dims: [f.rows], data: f.rowStart, type: 'int64' },
    { name: 'qtype', dims: [f.rows], data: f.qtype, type: 'int64' },
  ];
}

/**
 * SHA-256 over the whole feed: for each array in PACKED_INPUT_NAMES order, `name:dims:` then the raw
 * little-endian bytes (int64, or uint8 for the bool mask). The Python reference computes the same bytes
 * (crosspath/python_ref.py feed_sha256), so equality proves the two paths fed the model the same tensors.
 */
export function packedFeedSha256(f: PackedFeed): string {
  const h = createHash('sha256');
  for (const a of packedFeedArrays(f)) {
    h.update(`${a.name}:${a.dims.join('x')}:`);
    h.update(Buffer.from(a.data.buffer, a.data.byteOffset, a.data.byteLength));
  }
  return h.digest('hex');
}
