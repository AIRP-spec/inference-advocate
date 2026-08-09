// Demo scenario step registers for the instrument drawer.
//
// Paper: Section 4 end to end (demonstration only). SCENARIO_STEPS is the white-paper
// walkthrough in plain English. DEMO_STEPS is the shorter live-demo register with optional
// walkthrough targets into the product chrome. Not part of the client product surface.

export interface ScenarioStep {
  n: string;
  text: string;
}

/** Live-demo step. `target` is a `data-walkthrough` id when the presenter wants a highlight. */
export interface DemoStep {
  n: string;
  text: string;
  target?: string;
}

export const SCENARIO_STEPS: ScenarioStep[] = [
  {
    n: '01',
    text: 'On startup, the client fetches the list of registered providers and their current standing, and checks the signatures on both. This is signature math, not AI: no model is involved in verification.',
  },
  {
    n: '02',
    text: 'First provider: good standing. Its response arrives signed, from an address the register authorizes. Everything checks out, so the response is delivered without comment.',
  },
  {
    n: '03',
    text: 'A second clean response. Each exchange is appended to a local, tamper-evident log whose entries are chained together, so the record can be proven complete later.',
  },
  {
    n: '04',
    text: 'Second provider: reports from many clients, not just this one, have put it under elevated scrutiny. So its running score starts at 2 instead of zero.',
  },
  {
    n: '05',
    text: 'Its first response raises no flags. Score stays at 2, below the warning line of 4, so it is delivered without comment.',
  },
  {
    n: '06',
    text: 'Its second response gets flagged twice by the evaluator: mild flattery-seeking (severity 1) and language that builds artificial emotional attachment (severity 3). The score is now 6, past the warning line.',
  },
  {
    n: '07',
    text: 'That response is still delivered, but with a notice naming the score and the lines it sits between. The notice comes from your client, not from the provider.',
  },
  {
    n: '08',
    text: 'Its third response claims to be a person (severity 2). Score 8, which reaches the blocking line of 8.',
  },
  {
    n: '09',
    text: 'That response is withheld. It is stored locally, received and logged, but never shown, and you can choose to unlock and read it yourself. The block belongs to you, not to anyone upstream.',
  },
  {
    n: '10',
    text: 'Starting a new session resets the conversation, but not the record. After 5 clean responses, the warning line relaxes by 1 and the blocking line by 2.',
  },
  {
    n: '11',
    text: 'Third provider: excluded, based on aggregate reports across many clients. The client declines to even send it a request.',
  },
  {
    n: '12',
    text: 'Fourth provider: signs nothing at all, which is every real provider today. The response is labeled unsealed and still delivered; the missing signature is itself part of the record.',
  },
  {
    n: '13',
    text: 'The standing notice that the other party is a simulation, not a person, repeats every three hours. It has no close button, on purpose: no provider setting can remove it.',
  },
  {
    n: '14',
    text: 'Telemetry preview: the exact bytes that would leave this device, shown next to an inventory of everything that never does. Reports only leave in groups of 20 or more identical reports, and no group is that big yet, so nothing goes.',
  },
];

export const DEMO_STEPS: DemoStep[] = [
  {
    n: '01',
    text: 'Pick which provider serves you',
    target: 'provider-picker',
  },
  {
    n: '02',
    text: "Your message goes out with the client's claims attached",
    target: 'composer',
  },
  {
    n: '03',
    text: 'The response arrives signed',
    target: 'latest-message',
  },
  {
    n: '04',
    text: "The signature and the provider's register entry are checked",
    target: 'status-trail',
  },
  {
    n: '05',
    text: "Caught: the seal names a model this provider isn't registered to serve",
    target: 'status-trail',
  },
  {
    n: '06',
    text: 'This provider signs nothing, which is every real provider today',
    target: 'status-trail',
  },
];
