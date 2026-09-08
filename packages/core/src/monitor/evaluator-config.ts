// Choosing the semantic evaluator, and being honest about what that choice costs.
//
// Paper: step 8, and Section 9 ("Explaining the judge"). Provisional: Sections 3.3 and 3.4
// (required properties, and the deployment hierarchy).
//
// The provisional's deployment hierarchy is: the reference model on the device where the device
// permits, an accredited monitor operator otherwise, and never the provider under audit.
// kind: 'local' is the first of those tiers, injected by the host because core stays free of
// native runtimes. A hosted evaluator is the second tier without the accreditation, which does
// not exist yet. It is a legitimate way to run this today and it has two costs that have to be
// visible rather than buried in a config file:
//
//   1. Response content leaves the device to be evaluated. The export view lists the endpoint
//      as an outbound content path for exactly this reason.
//   2. If the evaluator is served by the same party as the provider under evaluation, that is
//      the self-audit conflict of Section 3.4. This module detects the obvious case by origin
//      and says so loudly. It cannot detect the non-obvious cases, and does not pretend to.

import { readFileSync, existsSync } from 'node:fs';
import { basename } from 'node:path';
import type { Evaluator } from './semantic.js';
import type { Taxonomy } from './taxonomy.js';
import { RuleEvaluator } from './evaluators/rule-evaluator.js';
import { ModelEvaluator } from './evaluators/model-evaluator.js';

export interface RuleEvaluatorConfig {
  kind: 'rule';
}

export interface ModelEvaluatorConfig {
  kind: 'model';
  /** Any OpenAI-compatible endpoint. A local server is the preferred deployment. */
  baseUrl: string;
  model: string;
  /** Environment variable holding the key, so a config file never carries a secret. */
  apiKeyEnv?: string;
  /** Fixed by default, because reproducible verdicts are a required property. */
  temperature?: number;
  seed?: number;
  timeoutMs?: number;
  note?: string;
}

/**
 * Decode templates the on-device evaluator can run. Must stay in register with
 * LocalEvaluator's constructor: v2.1 is the live pin, v3 is the compact line.
 */
export const LOCAL_PROMPT_TEMPLATES = ['v2.1', 'v3'] as const;
export type LocalPromptTemplateVersion = (typeof LOCAL_PROMPT_TEMPLATES)[number];
/** Omit promptTemplateVersion and construction stays here. The live pin is this template. */
export const LIVE_LOCAL_PROMPT_TEMPLATE: LocalPromptTemplateVersion = 'v2.1';

export function isLocalPromptTemplateVersion(value: unknown): value is LocalPromptTemplateVersion {
  return value === 'v2.1' || value === 'v3';
}

/**
 * On-device GGUF evaluator. Core never loads the native runtime: the host injects a factory
 * that constructs `@airp/evaluator-local`. Same port pattern as StoreBackend.
 */
export interface LocalEvaluatorConfig {
  kind: 'local';
  modelPath: string;
  /** Hex SHA-256 of the GGUF file. Construction refuses to load on mismatch. */
  modelSha256: string;
  contextSize?: number;
  /** GPU offload is optional and never required. CPU-only must work. */
  gpu?: boolean;
  timeoutMs?: number;
  /**
   * Decode template. Omit for the live pin (v2.1). v3 is the compact multi-label line the
   * training gate uses. Selecting v3 does not change the live pin. It is a development path
   * so a v3-trained candidate can be run as the same task it was trained on. Construction
   * refuses any other string.
   */
  promptTemplateVersion?: LocalPromptTemplateVersion;
  note?: string;
}

export type EvaluatorConfig = RuleEvaluatorConfig | ModelEvaluatorConfig | LocalEvaluatorConfig;

export type LocalEvaluatorFactory = (
  cfg: LocalEvaluatorConfig,
  taxonomy: Taxonomy,
) => Evaluator | Promise<Evaluator>;

export interface ResolvedEvaluator {
  evaluator: Evaluator;
  /** Endpoints that receive response content. Surfaced by the export view. */
  outboundContentPaths: string[];
  warnings: string[];
}

export function loadEvaluatorConfig(path: string): EvaluatorConfig {
  return JSON.parse(readFileSync(path, 'utf8')) as EvaluatorConfig;
}

function origin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

function resolvedLocalPromptTemplate(value: unknown): LocalPromptTemplateVersion {
  if (value === undefined) return LIVE_LOCAL_PROMPT_TEMPLATE;
  if (isLocalPromptTemplateVersion(value)) return value;
  throw new Error(
    `local evaluator config promptTemplateVersion ${JSON.stringify(value)} is not supported. ` +
      `Accepted values: ${LOCAL_PROMPT_TEMPLATES.join(', ')}. Omit the field for the live pin (${LIVE_LOCAL_PROMPT_TEMPLATE}).`,
  );
}

export interface ResolveEvaluatorInput {
  taxonomy: Taxonomy;
  config?: EvaluatorConfig;
  /** Base URLs of the providers this advocate is configured to front, for the conflict check. */
  providerBaseUrls?: string[];
  env?: NodeJS.ProcessEnv;
  /**
   * Host-injected constructor for kind: 'local'. Core does not import the native runtime.
   * Required when config.kind is 'local'; ignored otherwise.
   */
  localEvaluatorFactory?: LocalEvaluatorFactory;
}

export async function resolveEvaluator(input: ResolveEvaluatorInput): Promise<ResolvedEvaluator> {
  const warnings: string[] = [];
  const config = input.config ?? { kind: 'rule' };

  if (config.kind === 'rule') {
    const evaluator = new RuleEvaluator(input.taxonomy);
    warnings.push(
      `the semantic layer is running ${evaluator.id}@${evaluator.version}, which is reproducible and inspectable and has no judgment. See ARCHITECTURE.md`,
    );
    return { evaluator, outboundContentPaths: [], warnings };
  }

  if (config.kind === 'local') {
    if (!input.localEvaluatorFactory) {
      throw new Error(
        'evaluator config kind is local and no localEvaluatorFactory was injected. ' +
          'The host (daemon or desktop launcher) must construct the on-device evaluator. ' +
          '@airp/core does not load native model runtimes.',
      );
    }
    if (!config.modelPath || !config.modelSha256) {
      throw new Error('local evaluator config requires modelPath and modelSha256');
    }
    // Named here, not only inside the constructor, so a JSON config that asks for a template
    // the constructor does not know cannot load a GGUF first and fail later. Configuration
    // that silently does nothing is worse than none; the accepted values have to be in the
    // message a config author reads.
    const template = resolvedLocalPromptTemplate(config.promptTemplateVersion);
    const evaluator = await input.localEvaluatorFactory(config, input.taxonomy);
    // Basename only: startup warnings reach the UI, and an absolute path would publish host layout.
    // The template is named even when it is also in evaluator.version, because a mock or a
    // stale factory could omit it, and a v3-trained model quietly running at v2.1 is the
    // miss this field exists to make impossible.
    let localWarning =
      `the semantic layer is running ${evaluator.id}@${evaluator.version} on-device against ${basename(config.modelPath)} ` +
      `(template ${template})`;
    if (template !== LIVE_LOCAL_PROMPT_TEMPLATE) {
      localWarning +=
        '. Template v3 is a non-default development path. It is not a release. The live pin remains the vendor GGUF at v2.1.';
    }
    warnings.unshift(localWarning);
    return { evaluator, outboundContentPaths: [], warnings };
  }

  const env = input.env ?? process.env;
  const apiKey = config.apiKeyEnv ? env[config.apiKeyEnv] : undefined;
  if (config.apiKeyEnv && !apiKey) {
    throw new Error(
      `evaluator config names ${config.apiKeyEnv} for its key and that variable is not set. ` +
        `Set it, or switch the evaluator config to {"kind":"rule"}.`,
    );
  }

  const evaluatorOrigin = origin(config.baseUrl);
  const local = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])/.test(config.baseUrl);

  if (!local) {
    warnings.push(
      `the semantic evaluator is hosted at ${evaluatorOrigin}, so response content leaves this device to be evaluated. ` +
        'The export view lists it as an outbound content path. The provisional prefers on-device execution.',
    );
  }

  for (const providerUrl of input.providerBaseUrls ?? []) {
    if (origin(providerUrl) === evaluatorOrigin) {
      warnings.push(
        `SELF AUDIT CONFLICT: the evaluator and a configured provider are both served from ${evaluatorOrigin}. ` +
          'Provisional Section 3.4 prohibits a provider from operating the monitor that evaluates it. ' +
          'Point the evaluator at a different party.',
      );
    }
  }

  const options: ConstructorParameters<typeof ModelEvaluator>[1] = {
    baseUrl: config.baseUrl,
    model: config.model,
    temperature: config.temperature ?? 0,
    seed: config.seed ?? 1,
    timeoutMs: config.timeoutMs ?? 60_000,
  };
  if (apiKey) options.apiKey = apiKey;

  const evaluator = new ModelEvaluator(input.taxonomy, options);
  // Named first, and unconditionally, so that anyone reading the startup lines can tell which
  // evaluator actually ran. Configuration that silently does nothing is worse than none.
  warnings.unshift(
    `the semantic layer is running ${evaluator.id}@${evaluator.version} against ${evaluatorOrigin}`,
  );

  return {
    evaluator,
    // An evaluator on the loopback interface is not content leaving the device, which is the
    // whole reason the provisional prefers that tier.
    outboundContentPaths: local ? [] : [`${evaluatorOrigin} (semantic evaluator, receives response content)`],
    warnings,
  };
}

/**
 * Where the evaluator configuration comes from, in order: an explicit path, then the
 * AIRP_EVALUATOR_CONFIG environment variable, then nothing, which means the rule evaluator.
 * The environment variable exists so that the same demo and the same daemon can be run against
 * a real evaluator without editing either of them.
 */
export function discoverEvaluatorConfig(
  explicitPath?: string,
  env: NodeJS.ProcessEnv = process.env,
): EvaluatorConfig | undefined {
  const path = explicitPath ?? env['AIRP_EVALUATOR_CONFIG'];
  if (!path) return undefined;
  if (!existsSync(path)) {
    // No absolute path in the message: openAdvocate folds this into UI warnings, and those
    // must not publish host layout (home directories, usernames) on a reachable advocate.
    throw new Error('no evaluator config at the configured path');
  }
  return loadEvaluatorConfig(path);
}
