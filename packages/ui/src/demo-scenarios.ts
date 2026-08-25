// Scripted demo prompts and provider lookup for the intro dialog and the instrument drawer.
//
// Paper: steps 1, 4, 5, 7, 11, 12 (the live demonstration of those steps).
// Prompts match the in-person stage script. Provider ids follow data/providers.demo.json.

export const DEMO_PROMPTS = {
  normal: "What's the capital of Nepal, and since when?",
  wrongModel: 'How is this different from a normal content filter?',
  unsealed: 'When does the EU AI Act take effect?',
} as const;

export type DemoProviderKind = 'aligned' | 'legacy';

export function findDemoProvider(
  providers: Array<{ id: string; registerEntryId?: string | null }>,
  kind: DemoProviderKind,
): string | undefined {
  const id = kind === 'aligned' ? 'aligned' : 'legacy';
  const entry = kind === 'aligned' ? 'demo.aligned' : 'demo.legacy';
  return providers.find((p) => p.id === id)?.id ?? providers.find((p) => p.registerEntryId === entry)?.id;
}

export function nextDemoJurisdiction(
  currentId: string,
  available: Array<{ id: string }>,
): string | undefined {
  const prefer = currentId === 'eu' ? 'us-ny' : 'eu';
  if (available.some((j) => j.id === prefer)) return prefer;
  return available.find((j) => j.id !== currentId)?.id;
}

export type DemoScriptReply = {
  ok?: boolean;
  reason?: string;
  served?: number;
  substitutingNext?: boolean;
};

export type DemoScriptStatusKind = 'loading' | 'unreachable' | 'honest' | 'substituting';

export type DemoScriptStatus = {
  kind: DemoScriptStatusKind;
  label: string;
  served?: number;
};

export const LOADING_SCRIPT_STATUS: DemoScriptStatus = {
  kind: 'loading',
  label: 'checking script',
};

export function demoScriptStatus(reply: DemoScriptReply | null): DemoScriptStatus {
  if (!reply || reply.ok === false || typeof reply.substitutingNext !== 'boolean') {
    return { kind: 'unreachable', label: 'script unreachable' };
  }
  return {
    kind: reply.substitutingNext ? 'substituting' : 'honest',
    label: reply.substitutingNext ? 'next seal substitutes' : 'next seal is honest',
    served: typeof reply.served === 'number' ? reply.served : undefined,
  };
}

export function scriptStatusTitle(status: DemoScriptStatus): string {
  const shared = 'Shared by every visitor on this host. Opening this page does not reset it.';
  if (status.kind === 'loading') return `Reading the aligned mock. ${shared}`;
  if (status.kind === 'unreachable') return `Could not read the aligned mock. ${shared}`;
  const served = status.served === undefined ? '' : ` ${status.served} served so far.`;
  return `${status.label}.${served} ${shared}`;
}
