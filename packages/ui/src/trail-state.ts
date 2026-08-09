// Status trail state: six design stages driven by the core's ExchangeStage stream.
//
// Paper: steps 3 through 12. Spec §1.1: delivery presentation is out of scope, so this mapping
// is a reference choice. The trail never invents progress; it only compresses stages the
// pipeline already reports into the six marks the design uses.
//
// Core stages are finer than the marks (standing check, receive vs await, recording). Collapsing
// them here keeps the UI honest about what ran without asking the person to track nine names.
//
// `noted` is a non-blocking finding on a finished stage (unsealed or invalid seal on deliver).
// Settled trails collapse to a summary chip: noted or stopped when something is out of the
// ordinary, otherwise the last finished mark (usually deliver done).

import type { StageId } from './stages.js';
import type { ExchangeResult } from './types.js';

export const TRAIL_STAGES = [
  'send',
  'receive',
  'verify',
  'evaluate',
  'decide',
  'deliver',
] as const;

export type TrailStage = (typeof TRAIL_STAGES)[number];

export type MarkState = 'pending' | 'active' | 'done' | 'skipped' | 'stopped' | 'noted';

export type TrailMarks = MarkState[];

export const TRAIL_STAGE_LABELS: Record<TrailStage, string> = {
  send: 'Send',
  receive: 'Receive',
  verify: 'Verify',
  evaluate: 'Evaluate',
  decide: 'Decide',
  deliver: 'Deliver',
};

/** Which trail index a core stage lights as active. */
const STAGE_TO_TRAIL: Record<StageId, number> = {
  checking_standing: 0,
  awaiting_response: 1,
  receiving: 1,
  response_complete: 1,
  verifying_seal: 2,
  evaluating_content: 3,
  resolving_delivery: 4,
  recording: 4,
  delivering: 5,
};

const VERIFY_INDEX = 2;

export function emptyTrail(): TrailMarks {
  return TRAIL_STAGES.map(() => 'pending');
}

/**
 * Advance the trail for a newly reported core stage. Prior marks become done (unless already
 * skipped, stopped, or noted). The active index is the mapped trail stage.
 */
export function trailAfterStage(prev: TrailMarks, stage: StageId): TrailMarks {
  const active = STAGE_TO_TRAIL[stage] ?? 0;
  return TRAIL_STAGES.map((_, i) => {
    const cur = prev[i] ?? 'pending';
    if (cur === 'stopped' || cur === 'skipped' || cur === 'noted') return cur;
    if (i < active) return 'done';
    if (i === active) return 'active';
    return 'pending';
  });
}

export type TrailOutcome = Pick<ExchangeResult, 'decision' | 'deterministic' | 'semantic' | 'timings'>;

export type SealNote = 'unsealed' | 'seal_invalid';

/** Non-blocking seal finding on a delivered response, if any. */
export function sealNoteFromDeterministic(det: {
  sealPresent: boolean;
  sealValid: boolean;
}): SealNote | null {
  if (!det.sealPresent) return 'unsealed';
  if (!det.sealValid) return 'seal_invalid';
  return null;
}

/** Settled trail meta line for a seal note. */
export function sealNoteLabel(note: SealNote): string {
  return note === 'seal_invalid' ? 'Seal invalid' : 'Unsealed';
}

/**
 * Settle the trail from the exchange result. Withhold and refuse leave a permanent stopped mark
 * where the gate halted; evaluate is skipped when the deterministic layer refused before
 * semantic work ran. Delivered-but-unsealed (or invalid seal) leaves verify as noted so the
 * collapsed summary chip can show that finding instead of a blue deliver check.
 */
export function trailAfterResult(prev: TrailMarks, result: TrailOutcome): TrailMarks {
  const evaluateSkipped =
    !result.deterministic.passed && result.semantic.evaluatorId === 'none';
  const refusedBeforeSend =
    result.decision.kind === 'refuse' &&
    result.timings.providerMs === 0 &&
    result.timings.deterministicMs === 0;

  if (result.decision.kind === 'deliver' || result.decision.kind === 'deliver_with_notice') {
    const note = sealNoteFromDeterministic(result.deterministic);
    if (!note) return TRAIL_STAGES.map(() => 'done');
    return TRAIL_STAGES.map((_, i) => (i === VERIFY_INDEX ? 'noted' : 'done'));
  }

  if (refusedBeforeSend) {
    return TRAIL_STAGES.map((_, i) => (i === 0 ? 'stopped' : 'pending'));
  }

  // Halt at decide for withhold and for refuse after the request left. Deliver never runs.
  const haltAt = 4;
  return TRAIL_STAGES.map((_, i) => {
    if (i < haltAt) {
      if (i === 3 && evaluateSkipped) return 'skipped';
      const cur = prev[i] ?? 'pending';
      if (cur === 'skipped' || cur === 'noted') return cur;
      return 'done';
    }
    if (i === haltAt) return 'stopped';
    return 'pending';
  });
}

export function trailIsHalted(marks: TrailMarks): boolean {
  return marks.some((m) => m === 'stopped');
}

/** True when every mark finished cleanly as done (no noted / skipped / stopped). */
export function trailIsComplete(marks: TrailMarks): boolean {
  return marks.every((m) => m === 'done');
}

export type TrailSummaryMark = {
  stage: TrailStage;
  state: Exclude<MarkState, 'pending' | 'active'>;
};

/**
 * Mark for the collapsed trail chip. Prefer an out-of-ordinary finding (stopped, then noted),
 * otherwise the last finished stage (usually deliver done).
 */
export function trailSummaryMark(marks: TrailMarks): TrailSummaryMark {
  for (let i = 0; i < TRAIL_STAGES.length; i++) {
    if (marks[i] === 'stopped') return { stage: TRAIL_STAGES[i]!, state: 'stopped' };
  }
  for (let i = 0; i < TRAIL_STAGES.length; i++) {
    if (marks[i] === 'noted') return { stage: TRAIL_STAGES[i]!, state: 'noted' };
  }
  for (let i = TRAIL_STAGES.length - 1; i >= 0; i--) {
    const state = marks[i] ?? 'pending';
    if (state === 'done' || state === 'skipped') {
      return { stage: TRAIL_STAGES[i]!, state };
    }
  }
  return { stage: 'deliver', state: 'done' };
}

export function markTitle(stage: TrailStage, state: MarkState, note?: SealNote | null): string {
  const name = TRAIL_STAGE_LABELS[stage];
  if (state === 'noted') {
    if (stage === 'verify') {
      return note === 'seal_invalid' ? 'Verify: seal invalid' : 'Verify: unsealed';
    }
    return `${name}: noted`;
  }
  if (state === 'skipped') return `${name}: skipped`;
  if (state === 'stopped') return `${name}: stopped`;
  if (state === 'done') return `${name}: done`;
  if (state === 'active') return `${name}: in progress`;
  return name;
}
