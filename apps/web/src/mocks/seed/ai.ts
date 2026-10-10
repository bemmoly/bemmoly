import type {
  AiModelRole,
  AiPrompt,
  AiProvider,
  AiRole,
  AiSettingsResponse,
  AiUsageBucket,
} from '@bemmoly/shared';
import { AI_ROLES } from '@bemmoly/shared';
import { capabilitiesOf, catalogModels, catalogSummary, demoProviderId } from './ai-catalog.ts';
import { USER_IDS } from './people.ts';
import { ago, uid } from './time.ts';

/** The AI runtime's state in the mock: what Settings › AI reads and writes. */
export interface MockAi {
  settings: AiSettingsResponse;
  providers: AiProvider[];
  /** Write-only values by provider id; the API only ever says which names are set. */
  secrets: Record<string, Record<string, string>>;
  roles: Record<AiRole, AiModelRole | null>;
  /** People who turned AI off for themselves. */
  optedOut: string[];
  prompts: AiPrompt[];
  catalogFetchedAt: string | null;
  /** This month's usage from ai_runs, as the server aggregates it. */
  usage: { byRole: AiUsageBucket[]; byPurpose: AiUsageBucket[]; byModel: AiUsageBucket[] };
}

export const PROVIDER_ID = uid(900);

const OFF_SETTINGS: AiSettingsResponse = {
  providerChoice: null,
  privacy: {
    enabled: false,
    shareContent: true,
    redactEmails: false,
    redactNames: false,
    excludedSpaceIds: [],
    excludedProjectIds: [],
    allowActions: true,
    perUserOptOutAllowed: true,
  },
  budget: { monthlyBudgetUsd: null },
  liveCatalog: true,
};

const bucket = (key: string, runs: number, cost: number): AiUsageBucket => ({
  key,
  runs,
  inputTokens: runs * 2400,
  outputTokens: runs * 310,
  costUsd: cost,
});

const PROMPT = (id: string, role: AiPrompt['role'], description: string, lines: string[]) => ({
  id,
  version: 1,
  role,
  description,
  variables: ['context'],
  outputSchema: null,
  defaultTemplate: [...lines, '', '{{context}}'].join('\n'),
  override: null,
});

function seedPrompts(): AiPrompt[] {
  return [
    PROMPT('issue.summary', 'standard', 'The TL;DR at the top of an issue', [
      'Summarise this issue for someone joining it today.',
      'Say what is decided, what is open and who is waiting on whom.',
      'Cite every claim with its source id.',
    ]),
    {
      ...PROMPT('docs.tldr', 'standard', 'The TL;DR card at the top of a page', [
        'Write a three-line TL;DR of this page.',
        'Lead with the decision, then the open questions.',
        'Cite every claim with its source id.',
      ]),
      override: {
        template: [
          'Write a three-line TL;DR of this page for an engineer.',
          'Lead with the decision, then the open questions.',
          'Cite every claim with its source id.',
          '',
          '{{context}}',
        ].join('\n'),
        updatedAt: ago(60 * 26),
        updatedBy: USER_IDS.rohan,
      },
    },
    PROMPT('palette.plan', 'strong', 'Plans the palette proposes before anything changes', [
      'Turn the request into a list of proposed changes.',
      'Only touch issues the request names or the context lists.',
    ]),
    PROMPT('home.brief', 'standard', 'The morning brief on Home', [
      'Say what changed for this person since their last visit, grouped by project.',
    ]),
    PROMPT('field.suggest', 'fast', 'Field suggestions while creating an issue', [
      'Suggest a type, priority and labels for this issue. Answer in JSON.',
    ]),
  ];
}

const EMPTY_ROLES = Object.fromEntries(AI_ROLES.map((role) => [role, null])) as MockAi['roles'];

/** AI off and nothing connected: a fresh install, or one that never set AI up. */
export function seedAiOff(): MockAi {
  return {
    settings: structuredClone(OFF_SETTINGS),
    providers: [],
    secrets: {},
    roles: { ...EMPTY_ROLES },
    optedOut: [],
    prompts: seedPrompts(),
    catalogFetchedAt: ago(4),
    usage: { byRole: [], byPurpose: [], byModel: [] },
  };
}

/** The demo's install: AI on, one popular provider connected, every role on its default. */
export function seedAiOn(): MockAi {
  const ai = seedAiOff();
  const catalogId = demoProviderId();
  const summary = catalogSummary(catalogId);
  if (!summary) return ai;
  ai.settings.providerChoice = catalogId;
  ai.settings.privacy.enabled = true;
  ai.settings.budget.monthlyBudgetUsd = 150;
  ai.providers = [
    {
      id: PROVIDER_ID,
      catalogId,
      name: summary.name,
      protocol: null,
      baseUrl: summary.api,
      loader: summary.loader,
      credentialsSet: [...summary.env],
      headersSet: [],
      models: [],
      isDefault: true,
      status: 'ok',
      lastCheckedAt: ago(42),
      lastError: null,
      createdAt: ago(60 * 24 * 9),
      updatedAt: ago(60 * 24 * 9),
    },
  ];
  ai.secrets[PROVIDER_ID] = Object.fromEntries(summary.env.map((name) => [name, 'stored']));
  const models = catalogModels(catalogId);
  for (const role of AI_ROLES) {
    const model = models.find((entry) => entry.suggestedFor.includes(role));
    if (!model) continue;
    ai.roles[role] = {
      role,
      providerId: PROVIDER_ID,
      providerName: summary.name,
      model: model.id,
      reasoningEffort: null,
      maxOutputTokens: null,
      temperature: null,
      capabilities: capabilitiesOf(model),
      deprecation: null,
      paused: false,
      updatedAt: ago(60 * 24 * 9),
    };
  }
  const name = (role: AiRole) => ai.roles[role]?.model ?? role;
  ai.usage = {
    byRole: [
      bucket('fast', 1840, 3.12),
      bucket('standard', 612, 31.4),
      bucket('strong', 88, 26.15),
      bucket('embedding', 5210, 0.73),
    ],
    byPurpose: [
      bucket('summary', 402, 21.9),
      bucket('plan', 88, 26.15),
      bucket('brief', 140, 6.8),
      bucket('qa', 70, 2.7),
      bucket('autocomplete', 1840, 3.12),
      bucket('embed', 5210, 0.73),
    ],
    byModel: [
      bucket(name('strong'), 88, 26.15),
      bucket(name('standard'), 612, 31.4),
      bucket(name('fast'), 1840, 3.12),
      bucket(name('embedding'), 5210, 0.73),
    ],
  };
  return ai;
}
