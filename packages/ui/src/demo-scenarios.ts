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
