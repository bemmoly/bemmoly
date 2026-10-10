import { AI_LANGUAGE_ROLES, AI_ROLES, type AiLanguageRole } from '@bemmoly/shared';
import type { AiFacade, AiPolicy, AiRenderedPrompt } from '../../contracts/ai.ts';
import { aiRefusal } from './refusals.ts';
import type { AiRunRecord } from './runtime/dependencies.ts';
import { createAiFacade } from './runtime/facade.ts';
import {
  createMockEmbeddingModel,
  createMockLanguageModel,
  mockEmbedding,
  mockLanguage,
  type MockCall,
  type MockReply,
} from './runtime/mock-models.ts';
import { createStaticModelSource } from './runtime/registry.ts';

export type { MockReply as TestAiReply } from './runtime/mock-models.ts';

/** The facade on the SDK's mock models, plus handles to script and inspect it. */
export interface TestAi extends AiFacade {
  /** Queues replies, used in order; once empty, `respond` (or "ok") answers. */
  queue(...replies: MockReply[]): void;
  /** Answers every call not covered by the queue. */
  respond(reply: (call: MockCall) => MockReply): void;
  /** What the model received, after redaction, one entry per model call. */
  readonly calls: MockCall[];
  /** Every ai_runs row the facade recorded. */
  readonly runs: AiRunRecord[];
  /** Every batch of values sent to the embedding model. */
  readonly embedded: string[][];
  setPolicy(change: Partial<AiPolicy>): void;
  /** Adds a prompt `renderPrompt` can render: `{{name}}` placeholders, no files. */
  addPrompt(id: string, prompt: Omit<AiRenderedPrompt, 'promptRef'> & { version?: number }): void;
}

export interface TestAiOptions {
  policy?: Partial<AiPolicy>;
  replies?: MockReply[];
  dimensions?: number;
  /** Names the redaction replaces when the policy turns name redaction on. */
  names?: string[];
}

const ON_POLICY: AiPolicy = {
  enabled: true,
  shareContent: true,
  redactEmails: false,
  redactNames: false,
  excludedSpaceIds: [],
  excludedProjectIds: [],
  allowActions: true,
  perUserOptOutAllowed: false,
  optedOutUserIds: [],
  actorOptedOut: false,
  budgetState: 'unlimited',
  availableRoles: AI_ROLES,
};

function fill(template: string, variables: Readonly<Record<string, string>>): string {
  return template.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (_, name: string) => {
    return variables[name] ?? '';
  });
}

/**
 * An AI facade for tests in any package: AI on, every role available, no provider and no
 * network. Real facade code runs (policy gate, redaction, structured-output repair, run log),
 * so a feature's test exercises the same path production does.
 */
export function createTestAi(options: TestAiOptions = {}): TestAi {
  const calls: MockCall[] = [];
  const runs: AiRunRecord[] = [];
  const embedded: string[][] = [];
  const queue: MockReply[] = [...(options.replies ?? [])];
  let fallback: (call: MockCall) => MockReply = () => ({ text: 'ok' });
  let policy: AiPolicy = { ...ON_POLICY, ...options.policy };
  const prompts = new Map<string, AiRenderedPrompt>();

  const next = () => queue.shift() ?? fallback(calls[calls.length - 1] ?? { prompt: [] });
  const language = Object.fromEntries(
    AI_LANGUAGE_ROLES.map((role) => [
      role,
      mockLanguage(createMockLanguageModel({ next, calls, modelId: `test-${role}` })),
    ]),
  ) as Record<AiLanguageRole, ReturnType<typeof mockLanguage>>;
  const embedding = mockEmbedding(createMockEmbeddingModel(options.dimensions ?? 8, embedded));

  const facade = createAiFacade({
    models: createStaticModelSource({ language, embedding }),
    policy: { policy: async () => policy },
    runs: {
      record: async (run) => {
        runs.push(run);
        return `00000000-0000-7000-8000-${String(runs.length).padStart(12, '0')}`;
      },
    },
    prompts: {
      render: async (id, variables) => {
        const prompt = prompts.get(id);
        if (!prompt) throw aiRefusal('role_unset');
        return {
          ...prompt,
          system: fill(prompt.system, variables),
          prompt: fill(prompt.prompt, variables),
        };
      },
    },
    names: { names: async () => options.names ?? [] },
    maxRetries: 0,
  });

  return {
    ...facade,
    queue: (...replies) => {
      queue.push(...replies);
    },
    respond: (reply) => {
      fallback = reply;
    },
    calls,
    runs,
    embedded,
    setPolicy: (change) => {
      policy = { ...policy, ...change };
    },
    addPrompt: (id, prompt) => {
      const { version = 1, ...rest } = prompt;
      prompts.set(id, { ...rest, promptRef: { id, version } });
    },
  };
}
