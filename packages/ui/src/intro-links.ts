// Outbound references from the first-run intro. Paper: steps 1 and 12 (presentation).
// These are the four public documents a visitor can leave this demo through. Kept as data
// so a test can fail if a URL drifts.

export type IntroMoreLink = {
  href: string;
  label: string;
  detail: string;
};

export const INTRO_MORE_LINKS: readonly IntroMoreLink[] = [
  {
    href: 'https://github.com/AIRP-spec/inference-advocate',
    label: 'The code',
    detail: 'reference client on GitHub',
  },
  {
    href: 'https://doi.org/10.5281/zenodo.21610185',
    label: 'The paper',
    detail: 'Accountable Inference Reputation Protocol (AIRP)',
  },
  {
    href: 'https://datatracker.ietf.org/doc/draft-flores-airp-provenance/',
    label: 'The IETF draft',
    detail: 'draft-flores-airp-provenance',
  },
  {
    href: 'https://logosanalog.com/p/we-can-pace-the-frontier-today-heres',
    label: 'The essay',
    detail: "We can pace the frontier today. Here's how.",
  },
];
