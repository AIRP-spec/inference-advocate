// Instrument drawer: demo-simulation and explanatory annotation, structurally below the
// client. Shut by default. Dark inversion so it cannot be mistaken for product.
//
// Paper: steps 1 and 12 (presentation of the apparatus). Not a product surface.
// Values and layout from reference/Inference Advocate Client.dc.html.
// Scenario tab: white-paper register or live-demo register; optional UI walkthrough highlight.
// Live demo also shows the build's startup gaps under the steps (no separate Gaps tab).
// The What is this? pill reopens the intro dialog without opening the drawer.

import { useEffect, useState, type Ref } from 'react';
import type { AdvocateState } from './types';
import { MonitorPanel } from './MonitorPanel';
import { ExportView } from './ExportView';
import { DEMO_STEPS, SCENARIO_STEPS, type DemoStep, type ScenarioStep } from './scenario-steps';
import { IconAirp } from './icons';
import { WhatIsThisButton } from './IntroDialog';

export type DrawerTab = 'monitor' | 'scenario' | 'export' | 'attrs';

type ScenarioRegister = 'paper' | 'demo';

const WALKTHROUGH_CLASS = 'walkthrough-highlight';

function clearWalkthroughHighlights(): void {
  document.querySelectorAll(`.${WALKTHROUGH_CLASS}`).forEach((el) => {
    el.classList.remove(WALKTHROUGH_CLASS);
  });
}

export function InstrumentDrawer(props: {
  open: boolean;
  tab: DrawerTab;
  state: AdvocateState | null;
  onOpen: () => void;
  onClose: () => void;
  onTab: (tab: DrawerTab) => void;
  onChildMode: (child: boolean) => void;
  onResetReputation: (providerId?: string) => void;
  onResetSubstitution: () => void;
  onOpenIntro: () => void;
  introButtonRef: Ref<HTMLButtonElement>;
  introTabButtonRef: Ref<HTMLButtonElement>;
  onWrongModel: () => void;
  onUnsealed: () => void;
  onSwitchJurisdiction: () => void;
  onJurisdiction: (id: string) => void;
  scenarioStep: number;
  onScenarioStep: (step: number) => void;
}) {
  const {
    open,
    tab,
    state,
    onOpen,
    onClose,
    onTab,
    onChildMode,
    onResetReputation,
    onResetSubstitution,
    onOpenIntro,
    introButtonRef,
    introTabButtonRef,
    onWrongModel,
    onUnsealed,
    onSwitchJurisdiction,
    onJurisdiction,
    scenarioStep,
    onScenarioStep,
  } = props;

  const [scenarioRegister, setScenarioRegister] = useState<ScenarioRegister>('paper');
  const steps = scenarioRegister === 'demo' ? DEMO_STEPS : SCENARIO_STEPS;

  const withheld = state?.providers.reduce((n, p) => n + p.openBlocks.length, 0) ?? 0;
  const providerCount = state?.providers.length ?? 0;
  const stepLabel = `${scenarioStep + 1}/${steps.length}`;

  if (!open) {
    return (
      <div className="instrument-drawer shut">
        <div className="drawer-strip">
          <button type="button" className="drawer-strip-open" onClick={onOpen}>
            <IconAirp className="drawer-strip-icon" />
            <span className="label">▲ Instruments</span>
          </button>
          <WhatIsThisButton onClick={onOpenIntro} buttonRef={introButtonRef} />
          <button type="button" className="drawer-strip-rest" onClick={onOpen}>
            <span className="aside">demonstration only · not part of the client</span>
            <span className="chips">
              {withheld > 0 && (
                <span className="chip alert">
                  {withheld} withheld
                </span>
              )}
              <span className="chip">step {stepLabel}</span>
              <span className="chip">
                {providerCount} provider{providerCount === 1 ? '' : 's'}
              </span>
            </span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="instrument-drawer open">
      <div className="drawer-tabs">
        <button type="button" className="drawer-close" onClick={onClose}>
          ▼
        </button>
        <WhatIsThisButton onClick={onOpenIntro} buttonRef={introTabButtonRef} />
        {(
          [
            ['monitor', 'Monitor'],
            ['scenario', 'Scenario'],
            ['export', 'What leaves'],
            ['attrs', 'Attributes'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`drawer-tab ${tab === id ? 'on' : ''}`}
            onClick={() => onTab(id)}
          >
            {label}
          </button>
        ))}
        <span className="ships">nothing here ships</span>
      </div>

      <div className="drawer-body">
        {tab === 'monitor' && (
          <MonitorPanel
            state={state}
            onResetReputation={onResetReputation}
            onResetSubstitution={onResetSubstitution}
          />
        )}
        {tab === 'scenario' && (
          <ScenarioTab
            step={scenarioStep}
            providerCount={providerCount}
            warnings={state?.warnings ?? []}
            register={scenarioRegister}
            onRegister={(next) => {
              clearWalkthroughHighlights();
              setScenarioRegister(next);
              onScenarioStep(0);
            }}
            onStep={onScenarioStep}
            onWrongModel={onWrongModel}
            onUnsealed={onUnsealed}
            onSwitchJurisdiction={onSwitchJurisdiction}
          />
        )}
        {tab === 'export' && <ExportView floorFromPolicy={state?.policy.telemetry.granularityFloor ?? null} />}
        {tab === 'attrs' && (
          <AttributesTab
            state={state}
            onChildMode={onChildMode}
            onJurisdiction={onJurisdiction}
          />
        )}
      </div>
    </div>
  );
}

function ScenarioTab(props: {
  step: number;
  providerCount: number;
  warnings: string[];
  register: ScenarioRegister;
  onRegister: (register: ScenarioRegister) => void;
  onStep: (step: number) => void;
  onWrongModel: () => void;
  onUnsealed: () => void;
  onSwitchJurisdiction: () => void;
}) {
  const { step, providerCount, warnings, register, onRegister, onStep, onWrongModel, onUnsealed, onSwitchJurisdiction } = props;
  const [highlightUi, setHighlightUi] = useState(false);
  const steps: Array<ScenarioStep | DemoStep> =
    register === 'demo' ? DEMO_STEPS : SCENARIO_STEPS;
  const last = steps.length - 1;
  const active = steps[step];
  const target = active && 'target' in active ? active.target : undefined;
  // White-paper steps have no walkthrough targets; keep the control off and inert.
  const highlightEnabled = register === 'demo';
  const highlightOn = highlightEnabled && highlightUi;

  useEffect(() => {
    if (!highlightEnabled && highlightUi) setHighlightUi(false);
  }, [highlightEnabled, highlightUi]);

  useEffect(() => {
    clearWalkthroughHighlights();
    if (!highlightOn || !target) return;

    const matches = document.querySelectorAll(`[data-walkthrough="${target}"]`);
    // Prefer the last match: newest message / newest trail in document order.
    const el = matches[matches.length - 1] as HTMLElement | undefined;
    if (!el) return;

    el.classList.add(WALKTHROUGH_CLASS);
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    return () => {
      el.classList.remove(WALKTHROUGH_CLASS);
    };
  }, [highlightOn, step, register, target]);

  return (
    <div className="scenario-pane">
      <div className="scenario-controls">
        <select
          className="scenario-register"
          value={register}
          aria-label="Scenario register"
          onChange={(e) => {
            setHighlightUi(false);
            onRegister(e.target.value as ScenarioRegister);
          }}
        >
          <option value="paper">White paper scenario (the full design)</option>
          <option value="demo">Live demo (what runs today)</option>
        </select>
        <label
          className={`scenario-highlight${highlightEnabled ? '' : ' disabled'}`}
          title={
            highlightEnabled
              ? undefined
              : 'Highlight UI is only available in the live demo register'
          }
        >
          <input
            type="checkbox"
            checked={highlightOn}
            disabled={!highlightEnabled}
            onChange={(e) => {
              if (!e.target.checked) clearWalkthroughHighlights();
              setHighlightUi(e.target.checked);
            }}
          />
          Highlight UI
        </label>
        <button
          type="button"
          className="scenario-btn"
          disabled={step <= 0}
          onClick={() => onStep(Math.max(0, step - 1))}
        >
          ← back
        </button>
        <span className="scenario-step-label">
          step {step + 1} of {steps.length}
        </span>
        <button
          type="button"
          className="scenario-btn"
          disabled={step >= last}
          onClick={() => onStep(Math.min(last, step + 1))}
        >
          next →
        </button>
        <button type="button" className="scenario-btn" onClick={() => onStep(0)}>
          replay from start
        </button>
        <span className="scenario-providers">
          {providerCount} mock providers on 127.0.0.1:8811–8814
        </span>
      </div>
      <div className="scenario-live">
        <button type="button" className="intro-chip" onClick={onWrongModel}>
          Wrong-model scenario
        </button>
        <button type="button" className="intro-chip" onClick={onUnsealed}>
          Unsealed scenario
        </button>
        <button type="button" className="intro-chip" onClick={onSwitchJurisdiction}>
          Switch jurisdiction
        </button>
      </div>
      <div className="scenario-steps">
        {steps.map((s, i) => (
          <div key={s.n} className={`scenario-step ${i === step ? 'current' : ''}`}>
            <span className="n">{s.n}</span>
            <span className="t">{s.text}</span>
          </div>
        ))}
      </div>
      {register === 'demo' && <GapsSection warnings={warnings} />}
    </div>
  );
}

function GapsSection({ warnings }: { warnings: string[] }) {
  return (
    <section className="scenario-gaps" aria-label="Gaps in this build">
      <h3 className="scenario-gaps-title">Gaps in this build</h3>
      <p className="gaps-intro">
        The advocate reports these about itself at startup. A reference implementation that
        overstates itself is worse than none.
      </p>
      {warnings.length === 0 ? (
        <p className="gaps-intro">No startup warnings reported yet.</p>
      ) : (
        <div className="gaps-grid">
          {warnings.map((w, i) => (
            <div key={i} className="gap-row">
              <span className="mark">not built</span>
              <span className="text">{w}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AttributesTab(props: {
  state: AdvocateState | null;
  onChildMode: (child: boolean) => void;
  onJurisdiction: (id: string) => void;
}) {
  const { state, onChildMode, onJurisdiction } = props;
  const child = state ? !state.attestations.isAdult : false;
  const release = state?.policy.releaseAuthority;
  const nonReleasable = Object.entries(release?.byFlagType ?? {})
    .filter(([, v]) => v === 'non_releasable')
    .map(([k]) => k);
  const minor = state?.jurisdiction.minorOnly?.thresholdOverrides;

  return (
    <div className="attrs-pane">
      <div className="attrs-toggle-row">
        <button
          type="button"
          className={`child-toggle ${child ? 'on' : ''}`}
          onClick={() => onChildMode(!child)}
          title="Locally asserted. Not verified. Reference demo only."
        >
          <span className="track">
            <span className="knob" />
          </span>
          <span className="label">Child mode: {child ? 'on' : 'off'}</span>
        </button>
        <span className="attrs-caveat">locally asserted, not verified, reference demo only</span>
      </div>

      {state && (state.availableJurisdictions?.length ?? 0) > 0 && (
        <div className="jurisdiction-switch">
          <label>
            <span className="attrs-caveat">Jurisdiction ruleset · demo only</span>
            <select
              className="scenario-register"
              aria-label="Jurisdiction ruleset"
              value={state.jurisdiction.id}
              onChange={(e) => onJurisdiction(e.target.value)}
            >
              {state.availableJurisdictions!.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {child && (
        <div className="attrs-consequence">
          Child mode on: pending jurisdiction provisions for users under eighteen are still not
          applied as law. Self-release of withheld responses is refused until an adult attribute is
          asserted.
        </div>
      )}

      {state && (
        <div className="attrs-grid">
          <div className="kv-row">
            <span className="k">Attribute</span>
            <span className="v">{state.attestations.isAdult ? 'adult' : 'child'}</span>
          </div>
          <div className="kv-row">
            <span className="k">Issuer</span>
            <span className="v">{shortIssuer(state.attestations.issuer)}</span>
          </div>
          <div className="kv-row">
            <span className="k">Jurisdiction</span>
            <span className="v">{state.jurisdiction.id}</span>
          </div>
          <div className="kv-row">
            <span className="k">Default release authority</span>
            <span className="v">{release?.default ?? '—'}</span>
          </div>
          <div className="kv-row">
            <span className="k">Non-releasable categories</span>
            <span className="v">
              {nonReleasable.length ? nonReleasable.join(', ') : '—'}
            </span>
          </div>
          <div className="kv-row">
            <span className="k">Minor thresholds (pending)</span>
            <span className="v amber">
              {minor
                ? `warn ${minor.warn}, block ${minor.block}`
                : 'none listed on this ruleset'}
            </span>
          </div>
        </div>
      )}

      <p className="attrs-note">
        Attribute attestation is itself one of the gaps. Nothing here is verified against an
        issuer, which is why this panel sits below the floor and not in Settings.
      </p>
    </div>
  );
}

function shortIssuer(issuer: string): string {
  if (issuer === 'unverified-local-assertion' || issuer === 'self') return 'self';
  return issuer;
}
