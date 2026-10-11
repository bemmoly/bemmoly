import type {
  AiBudgetStatus,
  AiProviderTestResponse,
  AiRole,
  AiUsageBucket,
} from '@bemmoly/shared';
import { AI_BUDGET_PAUSED_ROLES } from '@bemmoly/shared';
import { audit, can, emit, type MockDb } from '../db.ts';
import { seedAiOff, seedAiOn, type MockAi } from '../seed/ai.ts';
import type { z } from 'zod';
import { fail, invalid, type MockRequest, type MockResponse } from '../types.ts';

/**
 * The AI state, seeded on first use for a mock database stored before AI existed (the dev
 * mock keeps its database in session storage across reloads).
 */
export function aiOf(db: MockDb): MockAi {
  const stored = db as MockDb & { ai?: MockAi };
  if (!stored.ai) stored.ai = db.initialized ? seedAiOn() : seedAiOff();
  return stored.ai;
}

/** On for the workspace: switched on and a language role to call. */
export function workspaceAiOn(db: MockDb): boolean {
  const ai = aiOf(db);
  return (
    ai.settings.privacy.enabled && Boolean(ai.roles.fast ?? ai.roles.standard ?? ai.roles.strong)
  );
}

/** On for this person: the workspace's answer, unless they turned it off for themselves. */
export function aiEnabledFor(db: MockDb, userId: string | null): boolean {
  const ai = aiOf(db);
  const optedOut = Boolean(
    userId && ai.settings.privacy.perUserOptOutAllowed && ai.optedOut.includes(userId),
  );
  return workspaceAiOn(db) && !optedOut;
}

export const CONFIGURE = 'ai.models.configure';

export function denied(db: MockDb): MockResponse | null {
  return can(db, CONFIGURE)
    ? null
    : fail(403, 'forbidden', 'You need "Configure models and data policy" to do that.');
}

/** Every AI change: audited, and announced so open clients refresh their AI surfaces. */
export function changed(db: MockDb, action: string, id: string | null = null): void {
  audit(db, action, 'ai', id);
  emit(db, 'ai.changed', id ? [id] : []);
}

const MONTH = () => new Date().toISOString().slice(0, 7);

export function budgetStatus(db: MockDb): AiBudgetStatus {
  const ai = aiOf(db);
  const spent = ai.usage.byRole.reduce((sum, row) => sum + row.costUsd, 0);
  const budget = ai.settings.budget.monthlyBudgetUsd;
  const ratio = budget === null ? null : budget === 0 ? 1 : spent / budget;
  const state =
    ratio === null ? 'unlimited' : ratio >= 1 ? 'paused' : ratio >= 0.8 ? 'warning' : 'ok';
  return {
    month: MONTH(),
    spentUsd: Math.round(spent * 100) / 100,
    budgetUsd: budget,
    ratio,
    state,
    pausedRoles: state === 'paused' ? [...AI_BUDGET_PAUSED_ROLES] : [],
  };
}

export function isPaused(db: MockDb, role: AiRole): boolean {
  return budgetStatus(db).pausedRoles.includes(role);
}

/** Two roles on one model are one row in "by model". */
export function merged(rows: readonly AiUsageBucket[]): AiUsageBucket[] {
  const byKey = new Map<string, AiUsageBucket>();
  for (const row of rows) {
    const seen = byKey.get(row.key);
    byKey.set(
      row.key,
      seen
        ? {
            key: row.key,
            runs: seen.runs + row.runs,
            inputTokens: seen.inputTokens + row.inputTokens,
            outputTokens: seen.outputTokens + row.outputTokens,
            costUsd: seen.costUsd + row.costUsd,
          }
        : { ...row },
    );
  }
  return [...byKey.values()].sort((a, b) => b.costUsd - a.costUsd);
}

/** Models a Local server reports in the mock: neutral names, one of them for embeddings. */
export const LOCAL_MODELS = [
  {
    id: 'house-chat-8b',
    name: 'house-chat-8b',
    toolCall: true,
    structuredOutput: true,
    embedding: false,
    contextWindow: 32_768,
  },
  {
    id: 'house-chat-70b',
    name: 'house-chat-70b',
    toolCall: true,
    structuredOutput: true,
    embedding: false,
    contextWindow: 131_072,
  },
  {
    id: 'house-embed',
    name: 'house-embed',
    toolCall: null,
    structuredOutput: null,
    embedding: true,
    contextWindow: 8192,
  },
];

/**
 * The mock's one cheap call. Addresses or keys containing "down" or "bad" fail the way a real
 * provider does, so the failure copy can be seen and tested.
 */
export function testResult(
  name: string,
  baseUrl: string | null,
  secrets: readonly string[],
  local: boolean,
): AiProviderTestResponse {
  const checkedAt = new Date().toISOString();
  if (baseUrl?.includes('down')) {
    return {
      ok: false,
      message: `${name} didn't answer at ${baseUrl}: connect ECONNREFUSED. Check the address and that the server is running.`,
      latencyMs: null,
      model: null,
      modelsFound: null,
      checkedAt,
    };
  }
  if (secrets.some((value) => value.includes('bad'))) {
    return {
      ok: false,
      message: `${name} refused the key: "Incorrect API key provided." Check the key and try again.`,
      latencyMs: 380,
      model: null,
      modelsFound: null,
      checkedAt,
    };
  }
  return {
    ok: true,
    message: `Connected · ${name} answered in 412 ms`,
    latencyMs: 412,
    model: local ? (LOCAL_MODELS[0]?.id ?? null) : null,
    modelsFound: local ? LOCAL_MODELS.length : null,
    checkedAt,
  };
}

type Parsed<T> = { data: T; refused?: never } | { data?: never; refused: MockResponse };

/** Parses a body with the shared schema, or the 400 the server would answer. */
export function parse<S extends z.ZodType>(schema: S, request: MockRequest): Parsed<z.output<S>> {
  const result = schema.safeParse(request.body ?? {});
  if (result.success) return { data: result.data };
  const issue = result.error.issues[0];
  return { refused: invalid(issue?.path.join('.') ?? '', issue?.message ?? 'Invalid value') };
}
