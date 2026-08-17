// First-run explainer for the public demo. Paper: steps 1 and 12 (presentation).
// Demonstration chrome, not a product surface. Copy for tab 1 is the design reference
// verbatim. Tab 2 ("How to demo") follows the live stage script, not the placeholder
// cards, because those cards described outcomes this build does not produce.

import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent, type Ref } from 'react';
import {
  IconAirp,
  IconDeliveryPolicy,
  IconInferenceAdvocate,
  IconJurisdiction,
  IconRuleEvaluator,
  IconServingRegister,
  IconTaxonomy,
} from './icons';
import { writeIntroDismissed } from './intro-storage';

export type IntroTab = 'explainer' | 'demo';

export function WhatIsThisButton(props: {
  onClick: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      type="button"
      ref={props.buttonRef}
      className="what-is-this"
      title="Show the introduction"
      onClick={(e) => {
        e.stopPropagation();
        props.onClick();
      }}
    >
      <IconAirp className="what-is-this-icon" />
      <span className="what-is-this-label">What is this?</span>
    </button>
  );
}

export function IntroDialog(props: {
  open: boolean;
  dismissed: boolean;
  onDismissedChange: (dismissed: boolean) => void;
  onClose: () => void;
  onWrongModel: () => void;
  onUnsealed: () => void;
  onSwitchJurisdiction: () => void;
  onResetSubstitution: () => void;
}) {
  const {
    open,
    dismissed,
    onDismissedChange,
    onClose,
    onWrongModel,
    onUnsealed,
    onSwitchJurisdiction,
    onResetSubstitution,
  } = props;

  const [tab, setTab] = useState<IntroTab>('explainer');
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const explainerTabId = useId();
  const demoTabId = useId();
  const explainerPanelId = useId();
  const demoPanelId = useId();

  useEffect(() => {
    if (open) setTab('explainer');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    panel?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const nodes = focusable(panel);
      if (nodes.length === 0) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  function setDismissed(next: boolean) {
    onDismissedChange(next);
    writeIntroDismissed(window.localStorage, next);
  }

  function onBackdrop(e: MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  function onTabKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setTab((t) => (t === 'explainer' ? 'demo' : 'explainer'));
    }
  }

  function runThenClose(action: () => void) {
    onClose();
    action();
  }

  return (
    <div className="intro-overlay" onMouseDown={onBackdrop}>
      <div
        ref={panelRef}
        className="intro-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="intro-header">
          <IconAirp className="intro-seal" />
          <div className="intro-heading">
            <h1 id={titleId}>What is AIRP?</h1>
            <p className="intro-kicker">Accountable Inference Reputation Protocol</p>
          </div>
          <button type="button" className="intro-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="intro-tabs" role="tablist" aria-label="Introduction">
          <button
            type="button"
            role="tab"
            id={explainerTabId}
            aria-controls={explainerPanelId}
            aria-selected={tab === 'explainer'}
            tabIndex={tab === 'explainer' ? 0 : -1}
            className={`intro-tab${tab === 'explainer' ? ' on' : ''}`}
            onClick={() => setTab('explainer')}
            onKeyDown={onTabKey}
          >
            What is AIRP?
          </button>
          <button
            type="button"
            role="tab"
            id={demoTabId}
            aria-controls={demoPanelId}
            aria-selected={tab === 'demo'}
            tabIndex={tab === 'demo' ? 0 : -1}
            className={`intro-tab${tab === 'demo' ? ' on' : ''}`}
            onClick={() => setTab('demo')}
            onKeyDown={onTabKey}
          >
            How to demo
          </button>
        </div>

        <div className="intro-body">
          {tab === 'explainer' ? (
            <div
              role="tabpanel"
              id={explainerPanelId}
              aria-labelledby={explainerTabId}
              className="intro-explainer"
            >
              <p className="intro-lead">
                This isn't really a demo of an app. It's a demo of a protocol.
              </p>
              <p>
                A protocol is just a shared set of rules that lets different systems trust each
                other without having to know each other first. You lean on dozens of them every
                day and never see a single one.
              </p>
              <p>
                Take email. When a message lands in your inbox, a few things have already quietly
                happened. One rule checked whether it really came from the domain it claims.
                Another decided what should happen if that check fails: deliver it, flag it, or
                drop it in spam. Another carried it across the open internet, so any mail app can
                talk to any mail server. You never see any of that. You just see the email, and
                you mostly trust it, because the plumbing underneath earned that trust before it
                reached you.
              </p>
              <p className="intro-pivot">Now think about the last answer an AI gave you.</p>
              <div className="intro-callout">
                Nothing checked whether it came from the model it claimed to be. Nothing checked
                whether it followed the rules that apply where you live. Nothing kept a record of
                whether that provider has a habit of getting this wrong. The answer just appeared,
                and you were expected to trust it.
              </div>
              <p className="intro-question">
                So why don't we have for AI what we've had for email since the 1980s?
              </p>
              <p>
                That's the question this project exists to answer. AIRP is an attempt at the
                missing plumbing.
              </p>

              <div className="intro-made-of">
                <div className="intro-section-label">What it's made of</div>
                <div className="intro-parts">
                  <span className="intro-part-icon protocol">
                    <IconAirp />
                  </span>
                  <p>
                    <strong>AIRP</strong> is the protocol all of this speaks. It's what lets any
                    advocate talk to any provider over an open wire, the same way any mail app can
                    reach any mail server. The parts below are what the advocate works with to
                    keep an answer honest.
                  </p>

                  <span className="intro-part-icon">
                    <IconInferenceAdvocate />
                  </span>
                  <p>
                    <strong>The Inference Advocate.</strong> The client itself, and the reason the
                    rest works. It sits in the path and answers to you, not to the provider. Same
                    idea as a web browser, which is still called a “user agent” because it was
                    built to work for you and not for the site you're visiting.
                  </p>

                  <span className="intro-part-icon">
                    <IconServingRegister />
                  </span>
                  <p>
                    <strong>Serving Register.</strong> The provider signs every answer it sends.
                    The register is the public list of which endpoints are actually allowed to
                    serve a given model, so the advocate can confirm that signature is genuine and
                    nobody's serving something else under the model's name.{' '}
                    <span className="intro-aside">(Email has this one. It's called SPF.)</span>
                  </p>

                  <span className="intro-part-icon">
                    <IconTaxonomy />
                  </span>
                  <p>
                    <strong>Taxonomy.</strong> The published list of what counts as a problem in
                    an answer: persona claims, relational hooks, sycophancy, a simulation hiding
                    that it's a simulation. It's public and versioned on purpose, so the rules
                    aren't a black box you have to take on faith.
                  </p>

                  <span className="intro-part-icon">
                    <IconRuleEvaluator />
                  </span>
                  <p>
                    <strong>Rule Evaluator.</strong> The part that reads each answer against that
                    taxonomy before you ever see it. Some checks are pure arithmetic: does the
                    signature match, is the endpoint authorized. Some take judgment about meaning.
                    This is the job email never had, because email only had to check who sent a
                    message, never what it said.
                  </p>

                  <span className="intro-part-icon">
                    <IconJurisdiction />
                  </span>
                  <p>
                    <strong>Jurisdiction.</strong> Your local law, loaded into the client and
                    applied at the moment the answer is delivered, so the same response can be
                    handled differently depending on where you actually are. Nothing in AI does
                    this today.
                  </p>

                  <span className="intro-part-icon">
                    <IconDeliveryPolicy />
                  </span>
                  <p>
                    <strong>Delivery Policy.</strong> Your rules for what happens when a check
                    fails: deliver, warn, hold, or refuse. You set the posture, the advocate
                    enforces it.{' '}
                    <span className="intro-aside">(Email's version is DMARC.)</span>
                  </p>
                </div>
              </div>

              <div className="intro-close-statement">
                The thing that ties them together: every one of these runs in a client that
                answers to you, not to the provider. That's the whole difference.
              </div>
            </div>
          ) : (
            <div role="tabpanel" id={demoPanelId} aria-labelledby={demoTabId} className="intro-demo">
              <p>
                Everything here is scripted. The responses are canned, so the same click always
                shows the same thing. You do not need an API key. Pick Aligned Reference Models
                unless a card says otherwise.
              </p>
              <div className="intro-section-label">What to try</div>
              <div className="intro-cards">
                <div className="intro-card">
                  <div className="intro-card-title">Send a normal request.</div>
                  <p>
                    Type <code>What's the capital of Nepal, and since when?</code> The provider is
                    registered and in good standing. The request is attested, the response is
                    sealed, the signature is checked, the content is evaluated, and the inference
                    is delivered. It still feels like a chat.
                  </p>
                </div>

                <div className="intro-card">
                  <div className="intro-card-actions">
                    <button
                      type="button"
                      className="intro-chip"
                      onClick={() => runThenClose(onWrongModel)}
                    >
                      Wrong-model scenario
                    </button>
                    <button type="button" className="intro-chip quiet" onClick={onResetSubstitution}>
                      Reset script
                    </button>
                  </div>
                  <p>
                    Same provider, next turn: <code>How is this different from a normal content
                    filter?</code> AIRP compares the sealed model name to the register. If the
                    seal names a model this provider is not registered to serve, the client
                    refuses. That decision is deterministic. No model is consulted. If this
                    provider has already been used, reset the script first so the next turn is
                    the substitution.
                  </p>
                </div>

                <div className="intro-card">
                  <div className="intro-card-actions">
                    <button
                      type="button"
                      className="intro-chip"
                      onClick={() => runThenClose(onUnsealed)}
                    >
                      Unsealed scenario
                    </button>
                  </div>
                  <p>
                    Switches to Legacy Serving Co and asks <code>When does the EU AI Act take
                    effect?</code> This provider signs nothing, which is every real provider
                    today. The response is labeled unsealed and still delivered. The missing
                    signature is itself part of the record.
                  </p>
                </div>

                <div className="intro-card">
                  <div className="intro-card-actions">
                    <button
                      type="button"
                      className="intro-chip"
                      onClick={() => runThenClose(onSwitchJurisdiction)}
                    >
                      Switch jurisdiction
                    </button>
                  </div>
                  <p>
                    The advocate loads a jurisdiction ruleset and applies it at delivery. New York
                    pins a non-human notice. The EU ruleset notices unsealed responses. The files
                    are illustrative encodings, not legal advice.
                  </p>
                </div>
              </div>
              <p className="intro-reopen-hint">
                You can reopen this at any time from <strong>What is this?</strong> in the status
                bar.
              </p>
            </div>
          )}
        </div>

        <footer className="intro-footer">
          <label className="intro-dont-show">
            <span className={`intro-check${dismissed ? ' on' : ''}`} aria-hidden="true">
              {dismissed ? '✓' : ''}
            </span>
            <input
              type="checkbox"
              checked={dismissed}
              onChange={(e) => setDismissed(e.target.checked)}
            />
            Don't show this on startup
          </label>
          <span className="intro-footer-spacer" />
          <button type="button" className="intro-start" onClick={onClose}>
            Start exploring
          </button>
        </footer>
      </div>
    </div>
  );
}

function focusable(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])')].filter(
    (el) => !el.hasAttribute('disabled') && el.offsetParent !== null,
  );
}
