// The chat surface.
//
// Paper: steps 1 and 12. "From the user's seat it looks almost exactly like the product they
// already use. The whole apparatus is invisible when nothing is wrong, which is the design
// goal."
//
// Client shell is light product UI. Demo-simulation and explanatory annotation live in the
// instrument drawer. Notices are pinned with no close button anywhere in this file, which is
// the entire implementation of non-dismissable. The intro dialog is the one first-run
// explanation that this is a protocol demonstration.
//
// Layout and styling from reference/Inference Advocate Client.dc.html.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AdvocateState, ExchangeResult, Notice } from './types';
import { askWithProgress, hostCall } from './host-client';
import { PolicyView } from './PolicyView';
import { ComposeGlass, ExchangeTrail } from './ExchangeTrail';
import { ComposeActivity, isComposeWordBoundary } from './compose-activity';
import { isStageId, type StageId } from './stages';
import {
  emptyTrail,
  sealNoteFromDeterministic,
  sealNoteLabel,
  trailAfterResult,
  trailAfterStage,
  type TrailMarks,
} from './trail-state';
import {
  applyTheme,
  readThemePreference,
  writeThemePreference,
  type ThemePreference,
} from './theme';
import { InstrumentDrawer, type DrawerTab } from './InstrumentDrawer';
import { IntroDialog } from './IntroDialog';
import { readIntroDismissed } from './intro-storage';
import { DEMO_PROMPTS, findDemoProvider, nextDemoJurisdiction } from './demo-scenarios';
import { ProviderPicker } from './ProviderPicker';
import { MarkdownBody } from './MarkdownBody';
import { IconDeliveryPolicy, IconInferenceAdvocate, IconRuleEvaluator } from './icons';

interface Turn {
  role: 'user' | 'assistant';
  text: string;
  result?: ExchangeResult;
  /** Settled status trail for this assistant turn, when the exchange finished. */
  trail?: TrailMarks;
}

type View = 'chat' | 'policy';

const NARROW_BP = 820;

export function App() {
  const [state, setState] = useState<AdvocateState | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [provider, setProvider] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<StageId | null>(null);
  const [activity, setActivity] = useState(0);
  const [trail, setTrail] = useState<TrailMarks>(() => emptyTrail());
  const [composeActivity, setComposeActivity] = useState(0);
  const composeEngine = useRef(new ComposeActivity());
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const liveExchangeRef = useRef<HTMLDivElement | null>(null);
  const responseStartRef = useRef<HTMLDivElement | null>(null);
  // Which turn just resolved, so a refusal can be seen arriving where the trail was rather than
  // appearing as if it had always been there. Cleared when the next exchange starts.
  const [resolvedTurn, setResolvedTurn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Prompt that failed mid-exchange, so Retry can re-ask without a second user bubble. */
  const [failedAsk, setFailedAsk] = useState<{ providerId: string; text: string } | null>(null);
  const [transportError, setTransportError] = useState<string | null>(null);
  const [view, setView] = useState<View>('chat');
  const [detailFor, setDetailFor] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('monitor');
  const [scenarioStep, setScenarioStep] = useState(8);
  const [narrow, setNarrow] = useState(
    () => (typeof window !== 'undefined' ? window.innerWidth < NARROW_BP : false),
  );
  const [theme, setTheme] = useState<ThemePreference>(() => readThemePreference());
  const [introOpen, setIntroOpen] = useState(() =>
    typeof window === 'undefined' ? false : !readIntroDismissed(window.localStorage),
  );
  const [introDismissed, setIntroDismissed] = useState(() =>
    typeof window === 'undefined' ? false : readIntroDismissed(window.localStorage),
  );
  const introStripRef = useRef<HTMLButtonElement | null>(null);
  const introTabRef = useRef<HTMLButtonElement | null>(null);
  // Fresh loads and bfcache restores both need the file's first provider, not whatever the
  // tab last had selected. After that bootstrap, the user's pick sticks for the session.
  const providerBootstrapped = useRef(false);

  const refresh = useCallback(async () => {
    const next = (await hostCall('state')) as AdvocateState;
    setState(next);
    const first = next.providers[0]?.id || '';
    setProvider((p) => {
      if (!providerBootstrapped.current) {
        providerBootstrapped.current = true;
        return first;
      }
      return next.providers.some((x) => x.id === p) ? p : first;
    });
  }, []);

  useEffect(() => {
    refresh().catch((e: unknown) => setError(String(e)));
  }, [refresh]);

  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      providerBootstrapped.current = false;
      refresh().catch((err: unknown) => setError(String(err)));
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [refresh]);

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < NARROW_BP);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system' || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [theme]);

  // Compose activity decays between keystrokes the same way arrival decays between chunks.
  useEffect(() => {
    const id = window.setInterval(() => {
      const next = composeEngine.current.value();
      setComposeActivity((prev) => (prev === next ? prev : next));
    }, 90);
    return () => window.clearInterval(id);
  }, []);

  // User just sent: scroll the new user turn to the top of the pane so the status trail under
  // it is readable rather than clipped under the composer.
  useEffect(() => {
    if (!busy) return;
    const id = window.requestAnimationFrame(() => {
      const scroller = transcriptRef.current;
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
      liveExchangeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(id);
  }, [busy]);

  // Response arrived: pin the start of that turn in view (not the bottom of a long body).
  useEffect(() => {
    if (!resolvedTurn) return;
    const id = window.requestAnimationFrame(() => {
      responseStartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(id);
  }, [resolvedTurn]);

  const bumpCompose = useCallback(
    (kind: 'char' | 'word' | 'paste', pasteText = '') => {
      if (busy) return;
      const next =
        kind === 'paste'
          ? composeEngine.current.observePaste(pasteText)
          : kind === 'word'
            ? composeEngine.current.observeWord()
            : composeEngine.current.observeChar();
      setComposeActivity(next);
    },
    [busy],
  );

  const pinnedNotices: Notice[] = useMemo(
    () => (state?.pinned ?? []).map((p) => p.notice),
    [state],
  );

  // Why sending is not possible right now, in words. A button that does nothing and says
  // nothing is the wrong behavior anywhere, and especially here.
  const blocked: string | null = !state
    ? 'Connecting to the local advocate.'
    : state.providers.length === 0
      ? 'No providers configured. Copy data/providers.demo.json to .advocate/providers.json and restart the daemon.'
      : !provider
        ? 'Choose a provider.'
        : null;

  async function send(opts?: { text?: string; providerId?: string; appendUser?: boolean }) {
    if (blocked) {
      setError(blocked);
      return;
    }
    const text = (opts?.text ?? input).trim();
    const providerId = opts?.providerId ?? provider;
    const appendUser = opts?.appendUser !== false;
    if (!text || busy) return;
    if (!opts?.text) {
      setInput('');
      composeEngine.current.reset();
      setComposeActivity(0);
    }
    if (appendUser) setTurns((t) => [...t, { role: 'user', text }]);
    setBusy(true);
    setStage(null);
    setActivity(0);
    setTrail(emptyTrail());
    setResolvedTurn(null);
    setError(null);
    setFailedAsk(null);
    let liveTrail = emptyTrail();
    try {
      const body = (await askWithProgress(providerId, text, {
        onStage: (next) => {
          if (!isStageId(next)) {
            setStage(null);
            return;
          }
          setStage(next);
          liveTrail = trailAfterStage(liveTrail, next);
          setTrail(liveTrail);
        },
        onArrival: setActivity,
      })) as { result?: ExchangeResult; error?: string };
      if (body.error || !body.result) throw new Error(body.error ?? 'no result');
      const result = body.result;
      const settled = trailAfterResult(liveTrail, result);
      // The trail does not fade into text. It is replaced, and the turn it is replaced by is
      // marked so that a withheld or refused outcome is seen taking its place.
      setTurns((t) => [
        ...t,
        { role: 'assistant', text: result.delivered ?? '', result, trail: settled },
      ]);
      setTrail(settled);
      setResolvedTurn(result.responseId);
      setFailedAsk(null);
      await refresh();
    } catch (e) {
      const raw = String(e);
      setError(raw);
      setFailedAsk({ providerId, text });
    } finally {
      setBusy(false);
      setActivity(0);
      setStage(null);
    }
  }

  function retryFailedAsk() {
    if (!failedAsk || busy) return;
    void send({ text: failedAsk.text, providerId: failedAsk.providerId, appendUser: false });
  }

  function formatAskError(message: string): string {
    if (/429|Too Many Requests/i.test(message)) {
      return `Evaluator rate-limited (429). Wait a moment, then retry. (${message})`;
    }
    return message;
  }

  async function release(result: ExchangeResult, actor: 'self' | 'custodian') {
    const body = (await hostCall('release', {
      providerId: result.providerId,
      responseId: result.responseId,
      actor,
    })) as { released: boolean; reason?: string; content?: string };
    if (body.released && body.content) {
      setTurns((t) =>
        t.map((turn) =>
          turn.result?.responseId === result.responseId ? { ...turn, text: body.content! } : turn,
        ),
      );
    } else {
      setError(body.reason ?? 'release refused');
    }
    await refresh();
  }

  async function newSession() {
    await hostCall('session.new');
    setTurns([]);
    setDetailFor(null);
    setError(null);
    setFailedAsk(null);
    setView('chat');
    await refresh();
  }

  async function setChildMode(child: boolean) {
    setError(null);
    try {
      await hostCall('attestations.set', { isAdult: !child });
      setTurns([]);
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }

  async function setWithholdUnverified(withhold: boolean) {
    setTransportError(null);
    try {
      const body = (await hostCall('transport.set', {
        withholdUnverifiedContent: withhold,
      })) as { ok: boolean; reason?: string };
      if (!body.ok) setTransportError(body.reason ?? 'this setting cannot be changed here');
      await refresh();
    } catch (e) {
      setTransportError(String(e));
    }
  }

  async function resetReputation(providerId?: string) {
    setError(null);
    try {
      await hostCall('reputation.reset', providerId ? { providerId } : {});
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }

  function closeIntro() {
    setIntroOpen(false);
    queueMicrotask(() => {
      (drawerOpen ? introTabRef : introStripRef).current?.focus();
    });
  }

  async function resetSubstitution() {
    setError(null);
    const id = findDemoProvider(state?.providers ?? [], 'aligned');
    try {
      const body = (await hostCall('demo.script', {
        action: 'reset',
        ...(id ? { providerId: id } : {}),
      })) as { ok?: boolean; reason?: string };
      if (body.ok === false) setError(body.reason ?? 'could not reset the substitution script');
    } catch (e) {
      setError(String(e));
    }
  }

  async function runWrongModel() {
    const id = findDemoProvider(state?.providers ?? [], 'aligned');
    if (!id) {
      setError('No Aligned Reference Models mock is configured.');
      return;
    }
    setProvider(id);
    setView('chat');
    setError(null);
    try {
      const body = (await hostCall('demo.script', { action: 'arm', providerId: id })) as {
        ok?: boolean;
        reason?: string;
      };
      if (body.ok === false) {
        setError(body.reason ?? 'could not arm the substitution script');
        return;
      }
    } catch (e) {
      setError(String(e));
      return;
    }
    void send({ text: DEMO_PROMPTS.wrongModel, providerId: id });
  }

  async function runUnsealed() {
    const id = findDemoProvider(state?.providers ?? [], 'legacy');
    if (!id) {
      setError('No Legacy Serving Co mock is configured.');
      return;
    }
    setProvider(id);
    setView('chat');
    setError(null);
    void send({ text: DEMO_PROMPTS.unsealed, providerId: id });
  }

  async function switchJurisdiction(id?: string) {
    const next =
      id ??
      nextDemoJurisdiction(state?.jurisdiction.id ?? '', state?.availableJurisdictions ?? []);
    if (!next) {
      setError('No other jurisdiction ruleset is available.');
      return;
    }
    setError(null);
    try {
      await hostCall('jurisdiction.set', { jurisdictionId: next });
      setTurns([]);
      setDetailFor(null);
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }

  const sessionTitle = 'Chat';

  return (
    <div className="app">
      <div className="app-row">
        {!narrow && (
          <aside className="sidebar">
            <div className="sidebar-brand" aria-label="Inference Advocate">
              <IconInferenceAdvocate className="sidebar-brand-mark" />
              <span className="sidebar-brand-name">Inference Advocate</span>
            </div>
            <button type="button" className="btn-new-session" onClick={() => void newSession()}>
              ＋ New session
            </button>

            <div className="session-list">
              <div className="session-group">
                <span className="session-group-label">Today</span>
                <span className="not-built">not built</span>
              </div>
              <button
                type="button"
                className={`session-item ${view === 'chat' ? 'active' : ''}`}
                onClick={() => setView('chat')}
              >
                Current session
              </button>
              <div className="session-group later">
                <span className="session-group-label">Earlier</span>
              </div>
              <div className="session-item muted">Session history</div>
            </div>

            <nav className="sidebar-footer">
              <button
                type="button"
                className={`nav-row ${view === 'chat' ? 'on' : ''}`}
                onClick={() => setView('chat')}
              >
                Chat
              </button>
              <button
                type="button"
                className={`nav-row between ${view === 'policy' ? 'on' : ''}`}
                onClick={() => setView('policy')}
              >
                Settings
                <span className="chevron">▾</span>
              </button>
              <button
                type="button"
                className={`nav-child with-icon ${view === 'policy' ? 'on' : ''}`}
                onClick={() => setView('policy')}
              >
                <IconDeliveryPolicy className="nav-icon" />
                Delivery Policy
              </button>
              <div className="nav-badge-row">
                <span className="nav-child muted">Providers</span>
                <span className="not-built">not built</span>
              </div>
              <div className="nav-badge-row">
                <span className="nav-child muted">Local store &amp; keys</span>
                <span className="not-built">not built</span>
              </div>
              <div className="account-row">
                <span className="account-label">
                  <span className="account-avatar" />
                  Account
                </span>
                <span className="not-built">not built</span>
              </div>
            </nav>
          </aside>
        )}

        <div className="main-col">
          {narrow && (
            <div className="narrow-header">
              <span className="narrow-brand" aria-hidden="true">
                <IconInferenceAdvocate className="narrow-brand-mark" />
              </span>
              <span className="narrow-title">{sessionTitle}</span>
              <button
                type="button"
                className="icon plus"
                onClick={() => void newSession()}
                aria-label="New session"
              >
                ＋
              </button>
            </div>
          )}

          {view === 'chat' && (
            <div className="chat-pane">
              <div className="transcript-scroller" ref={transcriptRef}>
                <div className="transcript-col">
                  {pinnedNotices.length > 0 && (
                    <section className="pinned-notices" aria-label="Pinned notices">
                      {pinnedNotices.map((n) => (
                        <div key={n.id} className="pinned-notice">
                          <span className="pinned-kicker">{noticeKicker(n.source)}</span>
                          <span className="pinned-body">{n.text}</span>
                        </div>
                      ))}
                    </section>
                  )}

                  {turns.length === 0 && !busy && (
                    <p className="empty">
                      Ask something. Nothing reaches this screen until the monitor has finished with
                      it.
                    </p>
                  )}

                  {turns.map((turn, i) => {
                    const latestAttrs =
                      i === turns.length - 1
                        ? ({ 'data-walkthrough': 'latest-message' } as const)
                        : undefined;
                    return turn.role === 'user' ? (
                      <div
                        key={i}
                        className="turn-user"
                        ref={
                          busy && i === turns.length - 1 ? liveExchangeRef : undefined
                        }
                        {...latestAttrs}
                      >
                        <div className="bubble-user">{turn.text}</div>
                      </div>
                    ) : turn.result ? (
                      <div
                        key={i}
                        className="turn-response"
                        ref={
                          resolvedTurn === turn.result.responseId ? responseStartRef : undefined
                        }
                        {...latestAttrs}
                      >
                        <AssistantTurn
                          result={turn.result}
                          text={turn.text}
                          trail={turn.trail}
                          open={detailFor === turn.result.responseId}
                          onToggle={() =>
                            setDetailFor((d) =>
                              d === turn.result!.responseId ? null : turn.result!.responseId,
                            )
                          }
                          onRelease={(actor) => void release(turn.result!, actor)}
                          taxonomy={state?.taxonomy.flags ?? []}
                          resolved={resolvedTurn === turn.result.responseId}
                          heldTransport={state?.transport.withholdUnverifiedContent ?? false}
                        />
                      </div>
                    ) : (
                      <div key={i} className="turn-assistant" {...latestAttrs}>
                        <MarkdownBody className="assistant-body" text={turn.text} />
                      </div>
                    );
                  })}

                  {busy && (
                    <div className="exchange-live">
                      <ExchangeTrail
                        marks={trail}
                        stage={stage}
                        activity={activity}
                        held={state?.transport.withholdUnverifiedContent ?? false}
                        settled={false}
                      />
                    </div>
                  )}
                  {error && (
                    <div className="error">
                      <span className="error-message">{formatAskError(error)}</span>
                      {failedAsk && (
                        <button
                          type="button"
                          className="btn-release secondary"
                          disabled={busy}
                          onClick={() => retryFailedAsk()}
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  )}
                  {blocked && !error && turns.length === 0 && <p className="empty">{blocked}</p>}
                </div>
              </div>

              <div className="composer-wrap">
                <div className="composer-col">
                  <div className="composer" data-walkthrough="composer">
                    <ComposeGlass activity={composeActivity} idle={busy} />
                    <textarea
                      value={input}
                      placeholder="Type a message"
                      rows={1}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void send();
                          return;
                        }
                        if (e.key === 'Backspace' || e.key === 'Delete') {
                          bumpCompose('char');
                          return;
                        }
                        if (e.key.length === 1) {
                          bumpCompose(isComposeWordBoundary(e.key) ? 'word' : 'char');
                        }
                      }}
                      onPaste={(e) => {
                        const text = e.clipboardData?.getData('text') ?? '';
                        bumpCompose('paste', text);
                      }}
                    />
                    <ProviderPicker
                      providers={state?.providers ?? []}
                      value={provider}
                      onChange={setProvider}
                    />
                    <button
                      type="button"
                      className="composer-send"
                      onClick={() => void send()}
                      disabled={busy || blocked !== null}
                      title={blocked ?? 'Send'}
                    >
                      ↑
                    </button>
                  </div>
                  <span className="composer-hint">
                    Nothing reaches this screen until the monitor has finished with it.
                  </span>
                </div>
              </div>
            </div>
          )}

          {view === 'policy' && (
            <PolicyView
              state={state}
              theme={theme}
              onThemeChange={(next) => {
                setTheme(next);
                writeThemePreference(next);
              }}
              onWithholdUnverified={(withhold) => void setWithholdUnverified(withhold)}
              transportError={transportError}
            />
          )}
        </div>
      </div>

      <InstrumentDrawer
        open={drawerOpen}
        tab={drawerTab}
        state={state}
        onOpen={() => setDrawerOpen(true)}
        onClose={() => setDrawerOpen(false)}
        onTab={setDrawerTab}
        onChildMode={(child) => void setChildMode(child)}
        onResetReputation={(providerId) => void resetReputation(providerId)}
        onResetSubstitution={() => void resetSubstitution()}
        onOpenIntro={() => setIntroOpen(true)}
        introButtonRef={introStripRef}
        introTabButtonRef={introTabRef}
        onWrongModel={() => void runWrongModel()}
        onUnsealed={() => void runUnsealed()}
        onSwitchJurisdiction={() => void switchJurisdiction()}
        onJurisdiction={(id) => void switchJurisdiction(id)}
        scenarioStep={scenarioStep}
        onScenarioStep={setScenarioStep}
      />
      <IntroDialog
        open={introOpen}
        dismissed={introDismissed}
        onDismissedChange={setIntroDismissed}
        onClose={closeIntro}
        onWrongModel={() => void runWrongModel()}
        onUnsealed={() => void runUnsealed()}
        onSwitchJurisdiction={() => void switchJurisdiction()}
        onResetSubstitution={() => void resetSubstitution()}
      />
    </div>
  );
}

function AssistantTurn(props: {
  result: ExchangeResult;
  text: string;
  trail?: TrailMarks;
  open: boolean;
  onToggle: () => void;
  onRelease: (actor: 'self' | 'custodian') => void;
  taxonomy: Array<{ type: string; definition: string }>;
  /** True for the turn that just replaced the status trail, so the outcome is seen arriving. */
  resolved: boolean;
  heldTransport: boolean;
}) {
  const { result, text, trail, open, onToggle, onRelease, taxonomy, resolved, heldTransport } =
    props;
  const kind = result.decision.kind;
  const flagCount = result.semantic.flags.length;
  const whyLabel = `${open ? 'hide' : 'why'} (${flagCount} flag${flagCount === 1 ? '' : 's'}, score ${result.decision.score})`;
  const authority = result.decision.releaseAuthority;
  const showSelf = authority === 'self_release';
  const showCustodian = authority === 'self_release' || authority === 'custodial_release';
  const showRelease = kind === 'withhold' && authority && authority !== 'non_releasable' && authority !== 'escalating';
  const sealNote =
    kind === 'deliver' || kind === 'deliver_with_notice'
      ? sealNoteFromDeterministic(result.deterministic)
      : null;

  const deliveryNotices =
    kind === 'deliver_with_notice'
      ? result.decision.notices.filter((n) => n.source === 'monitor')
      : [];

  return (
    <div className={`turn-assistant ${resolved ? 'resolved-in' : ''}`}>
      {trail && (
        <ExchangeTrail
          marks={trail}
          stage={null}
          label={sealNote ? sealNoteLabel(sealNote) : null}
          activity={0}
          held={heldTransport || result.transport === 'non_streamed'}
          settled
          sealNote={sealNote}
        />
      )}

      {kind === 'withhold' && (
        <div className="withheld">
          <p className="withheld-body">
            <strong>Withheld.</strong> This response is on your device and has not been rendered.
            Accumulated score {result.decision.score} against a block line of{' '}
            {result.decision.effectiveBlock}.
          </p>
          {authority && (
            <div className="withheld-authority">Release authority: {authority}</div>
          )}
          {showRelease && (
            <div className="withheld-actions">
              {showSelf && (
                <button type="button" className="btn-release" onClick={() => onRelease('self')}>
                  Release (self)
                </button>
              )}
              {showCustodian && (
                <button
                  type="button"
                  className="btn-release secondary"
                  onClick={() => onRelease('custodian')}
                >
                  Release (supervising party)
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {kind === 'refuse' && (
        <div className="refused">
          <strong>Refused.</strong>{' '}
          {result.decision.rationale.filter((r) => r.includes('refus')).join(' ') ||
            result.decision.rationale.join(' ')}
        </div>
      )}

      {deliveryNotices.map((n) => (
        <div key={n.id} className="delivery-notice">
          <span className="kicker">NOTICE</span>
          <span className="body">{n.text}</span>
        </div>
      ))}

      {kind === 'deliver_with_notice' && deliveryNotices.length === 0 && (
        <div className="delivery-notice">
          <span className="kicker">NOTICE</span>
          <span className="body">
            Window score {result.decision.score}, at the warn line of {result.decision.effectiveWarn}{' '}
            and below the block line of {result.decision.effectiveBlock}.
            {flagCount > 0
              ? ` Flagged ${result.semantic.flags.map((f) => f.type.replace(/_/g, ' ')).join(' and ')}.`
              : ''}{' '}
            Displayed by your advocate.
          </span>
        </div>
      )}

      {text && <MarkdownBody className="assistant-body" text={text} />}

      <div className="action-row">
        <button
          type="button"
          className={`why-link ${open ? 'open' : ''}`}
          onClick={onToggle}
        >
          {whyLabel}
        </button>
        {text && (
          <button
            type="button"
            className="copy-link"
            onClick={() => void navigator.clipboard?.writeText(text)}
          >
            Copy
          </button>
        )}
      </div>

      {open && (
        <div className="why-panel">
          <div className="why-grid">
            <div className="why-label">Provenance</div>
            <div className="why-value">{provenanceLine(result)}</div>
            <div className="why-label">
              <IconRuleEvaluator className="why-icon" />
              Evaluator
            </div>
            <div className="why-value mono">
              {result.semantic.evaluatorId}@{result.semantic.evaluatorVersion}, taxonomy{' '}
              {result.semantic.taxonomyVersion}
            </div>
            <div className="why-label">Flags</div>
            <div className="why-value">
              {result.semantic.flags.length === 0 && 'none'}
              {result.semantic.flags.map((f) => {
                const def =
                  taxonomy.find((t) => t.type === f.type)?.definition ?? f.basis;
                return (
                  <div key={f.type} className="flag-block">
                    <div className="flag-head">
                      <code>
                        {f.type} severity {f.severity}
                      </code>
                      <span className="flag-basis">{def}</span>
                    </div>
                    {f.evidence.map((e, i) => (
                      <div key={i} className="flag-evidence">
                        “{e.text}”
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
            <div className="why-label">Why this outcome</div>
            <div className="why-value">
              <ul className="rationale-list">
                {result.decision.rationale.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function noticeKicker(source: Notice['source']): string {
  if (source === 'policy') return 'POLICY';
  if (source === 'jurisdiction') return 'JURISDICTION';
  return 'NOTICE';
}

function provenanceLine(result: ExchangeResult): string {
  const modified = result.deterministic.findings.some((f) => f.code === 'request_modified');
  const seal = result.deterministic.sealPresent
    ? result.deterministic.sealValid
      ? modified
        ? 'sealed and verified, but the request was modified in transit'
        : 'sealed and verified against the Serving Register'
      : 'seal present and invalid'
    : 'unsealed';
  const endpoint = result.deterministic.endpointAuthorized
    ? 'endpoint authorized'
    : 'endpoint NOT authorized';
  const attribution =
    result.deterministic.attribution === 'confirmed'
      ? 'DNS-confirmed'
      : result.deterministic.attribution === 'unconfirmed'
        ? 'register-only (DNS unconfirmed)'
        : null;
  return attribution ? `${seal}, ${endpoint}, ${attribution}` : `${seal}, ${endpoint}`;
}

