// Accumulating status trail: settled stages as dots, one live (or halted / noted) full mark.
//
// Paper: steps 3 through 12. Each stage owns the same fixed cell with gap between cells, so
// open glyphs are large enough to hit and sit with space on both sides. Resting marks are dots
// in that cell; hover or a noted/active mark crossfades to the glyph without shifting layout.
// Vertical footprint stays fixed so the transcript does not reflow. Nothing after a stop is
// shown: a halt has not decided the later stages, so pending dots past it would be a lie.

import { StageMark } from './StageMark';
import {
  TRAIL_STAGES,
  markTitle,
  type MarkState,
  type SealNote,
  type TrailMarks,
  type TrailStage,
} from './trail-state';

type FinishedState = 'done' | 'skipped' | 'noted';

export function StatusTrail(props: {
  marks: TrailMarks;
  reducedMotion?: boolean;
  /** Distinguishes unsealed vs invalid on a noted verify mark. */
  sealNote?: SealNote | null;
}) {
  const { marks, reducedMotion = false, sealNote = null } = props;

  const settled: Array<{ stage: TrailStage; state: FinishedState }> = [];
  let current: {
    stage: TrailStage;
    state: 'active' | 'stopped' | 'done' | 'skipped';
  } | null = null;
  const pending: TrailStage[] = [];
  let halted = false;
  let pastCurrent = false;
  let hasNoted = false;

  for (let i = 0; i < TRAIL_STAGES.length; i++) {
    const stage = TRAIL_STAGES[i]!;
    const state = (marks[i] ?? 'pending') as MarkState;
    if (state === 'done' || state === 'skipped' || state === 'noted') {
      settled.push({ stage, state });
      if (state === 'noted') hasNoted = true;
      continue;
    }
    if (state === 'active' || state === 'stopped') {
      current = { stage, state };
      pastCurrent = true;
      if (state === 'stopped') halted = true;
      continue;
    }
    // pending
    if (halted) continue;
    if (pastCurrent || !current) pending.push(stage);
  }

  // A completed sealed trail is all `done`, with no active mark. Keep the last finished stage
  // as the full glyph so the row is not six identical dots. When a noted finding is present,
  // every finished mark stays in order and the noted one renders open in place.
  if (!current && settled.length > 0 && !hasNoted) {
    const last = settled.pop()!;
    if (last.state === 'done' || last.state === 'skipped') {
      current = { stage: last.stage, state: last.state };
    } else {
      settled.push(last);
      hasNoted = true;
    }
  }

  const showPending = pending.length > 0 && !halted;

  return (
    <div className="status-trail" aria-hidden="true">
      {settled.map((m) => {
        const title = markTitle(m.stage, m.state, sealNote);
        const noted = m.state === 'noted';
        return (
          <div
            key={m.stage}
            className={`status-trail-settled${noted ? ' is-noted' : ''}`}
            title={title}
          >
            <span
              className={`status-trail-dot status-trail-dot-${m.state}${
                reducedMotion ? '' : ' status-trail-dot-in'
              }`}
            />
            <span className="status-trail-glyph">
              <StageMark stage={m.stage} state={m.state} reducedMotion={reducedMotion} />
            </span>
          </div>
        );
      })}

      {current && (
        <div
          className="status-trail-slot status-trail-current"
          title={markTitle(current.stage, current.state, sealNote)}
        >
          <span
            className={`status-trail-glyph is-open${
              reducedMotion ? '' : ' status-trail-mark-in'
            }`}
          >
            <StageMark stage={current.stage} state={current.state} reducedMotion={reducedMotion} />
          </span>
        </div>
      )}

      {showPending &&
        pending.map((stage) => (
          <div key={stage} className="status-trail-pending-slot" title={stage}>
            <span className="status-trail-dot status-trail-dot-pending" />
          </div>
        ))}
    </div>
  );
}
