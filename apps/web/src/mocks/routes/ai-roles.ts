import {
  AI_ROLES,
  aiModelRoleBodySchema,
  aiPreferencesBodySchema,
  aiPromptOverrideBodySchema,
  aiRoleSchema,
  type AiCatalogModelEntry,
  type AiPromptDiffLine,
  type AiRole,
} from '@bemmoly/shared';
import { emit, type MockDb } from '../db.ts';
import { capabilitiesOf, catalogModels } from '../seed/ai-catalog.ts';
import { fail, invalid, notFound, ok, type MockRequest, type MockRoute } from '../types.ts';
import {
  aiEnabledFor,
  aiOf,
  budgetStatus,
  changed,
  denied,
  isPaused,
  merged,
  parse,
  workspaceAiOn,
} from './ai-state.ts';

const ADMIN = '/api/v1/admin/ai';

function rolesResponse(db: MockDb) {
  const ai = aiOf(db);
  return {
    items: AI_ROLES.map((role) => {
      const assignment = ai.roles[role];
      return {
        role,
        assignment: assignment ? { ...assignment, paused: isPaused(db, role) } : null,
      };
    }),
  };
}

/** The model a provider offers: from the catalog excerpt, or what a Local server reported. */
function modelEntry(
  db: MockDb,
  providerId: string,
  model: string,
): AiCatalogModelEntry | undefined {
  const provider = aiOf(db).providers.find((entry) => entry.id === providerId);
  if (!provider) return undefined;
  if (provider.catalogId !== 'custom') {
    return catalogModels(provider.catalogId).find((entry) => entry.id === model);
  }
  const found = provider.models.find((entry) => entry.id === model);
  if (!found) return undefined;
  return {
    id: found.id,
    name: found.name,
    family: null,
    toolCall: Boolean(found.toolCall),
    structuredOutput: Boolean(found.structuredOutput),
    reasoning: false,
    attachment: false,
    contextWindow: found.contextWindow,
    maxOutput: null,
    inputCostPerMillion: 0,
    outputCostPerMillion: 0,
    releaseDate: null,
    deprecated: false,
    eligibleRoles: found.embedding
      ? ['embedding']
      : found.toolCall
        ? ['fast', 'standard', 'strong']
        : ['fast', 'standard'],
    suggestedFor: [],
  };
}

function roleOf(request: MockRequest): AiRole | null {
  const parsed = aiRoleSchema.safeParse(request.params['role']);
  return parsed.success ? parsed.data : null;
}

/** A line diff good enough for the mock: lines only in one side are added or removed. */
function diffLines(before: string, after: string): AiPromptDiffLine[] {
  const old = before.split('\n');
  const next = after.split('\n');
  const lines: AiPromptDiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < old.length || j < next.length) {
    if (i < old.length && j < next.length && old[i] === next[j]) {
      lines.push({ kind: 'same', text: old[i] ?? '' });
      i += 1;
      j += 1;
    } else if (j < next.length && !old.slice(i).includes(next[j] ?? '')) {
      lines.push({ kind: 'added', text: next[j] ?? '' });
      j += 1;
    } else {
      lines.push({ kind: 'removed', text: old[i] ?? '' });
      i += 1;
    }
  }
  return lines;
}

export const aiRoleRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: `${ADMIN}/roles`,
    handle: (_, db) => denied(db) ?? ok(rolesResponse(db)),
  },
  {
    method: 'PUT',
    pattern: `${ADMIN}/roles/:role`,
    handle: (request, db) => {
      const refused = denied(db);
      if (refused) return refused;
      const role = roleOf(request);
      if (!role) return notFound('Role');
      const parsed = parse(aiModelRoleBodySchema, request);
      if (parsed.refused) return parsed.refused;
      const body = parsed.data;
      const provider = aiOf(db).providers.find((entry) => entry.id === body.providerId);
      if (!provider) return invalid('providerId', 'Connect this provider first.');
      const model = modelEntry(db, provider.id, body.model);
      if (!model?.eligibleRoles.includes(role)) {
        return invalid('model', `This model can't fill the ${role} role.`);
      }
      aiOf(db).roles[role] = {
        role,
        providerId: provider.id,
        providerName: provider.name,
        model: model.id,
        reasoningEffort: body.reasoningEffort,
        maxOutputTokens: body.maxOutputTokens,
        temperature: body.temperature,
        capabilities: capabilitiesOf(model),
        deprecation: null,
        paused: false,
        updatedAt: new Date().toISOString(),
      };
      changed(db, 'ai.role.assigned', role);
      return ok();
    },
  },
  {
    method: 'DELETE',
    pattern: `${ADMIN}/roles/:role`,
    handle: (request, db) => {
      const refused = denied(db);
      if (refused) return refused;
      const role = roleOf(request);
      if (!role) return notFound('Role');
      aiOf(db).roles[role] = null;
      changed(db, 'ai.role.cleared', role);
      return ok();
    },
  },
  {
    method: 'GET',
    pattern: `${ADMIN}/usage`,
    handle: (_, db) => {
      const refused = denied(db);
      if (refused) return refused;
      const { usage } = aiOf(db);
      const sum = (key: 'runs' | 'inputTokens' | 'outputTokens' | 'costUsd') =>
        usage.byRole.reduce((total, row) => total + row[key], 0);
      return ok({
        budget: budgetStatus(db),
        totals: {
          runs: sum('runs'),
          inputTokens: sum('inputTokens'),
          outputTokens: sum('outputTokens'),
          costUsd: sum('costUsd'),
        },
        byRole: merged(usage.byRole),
        byPurpose: merged(usage.byPurpose),
        byModel: merged(usage.byModel),
        failures: usage.byRole.length > 0 ? 3 : 0,
        feedback: {
          useful: usage.byRole.length > 0 ? 41 : 0,
          not_useful: usage.byRole.length > 0 ? 6 : 0,
        },
      });
    },
  },
  {
    method: 'GET',
    pattern: `${ADMIN}/prompts`,
    handle: (_, db) => denied(db) ?? ok({ items: aiOf(db).prompts }),
  },
  {
    method: 'PUT',
    pattern: `${ADMIN}/prompts/:id/override`,
    handle: (request, db) => {
      const refused = denied(db);
      if (refused) return refused;
      const prompt = aiOf(db).prompts.find((entry) => entry.id === request.params['id']);
      if (!prompt) return notFound('Prompt');
      const parsed = parse(aiPromptOverrideBodySchema, request);
      if (parsed.refused) return parsed.refused;
      const used = [...parsed.data.template.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map(
        (m) => m[1] ?? '',
      );
      const unknown = used.find((name) => !prompt.variables.includes(name));
      if (unknown) {
        return invalid(
          'template',
          `{{${unknown}}} isn't a variable this prompt has. Use ${prompt.variables.map((v) => `{{${v}}}`).join(', ')}.`,
        );
      }
      prompt.override = {
        template: parsed.data.template,
        updatedAt: new Date().toISOString(),
        updatedBy: db.signedInAs,
      };
      changed(db, 'ai.prompt.overridden', prompt.id);
      return ok(prompt);
    },
  },
  {
    method: 'DELETE',
    pattern: `${ADMIN}/prompts/:id/override`,
    handle: (request, db) => {
      const refused = denied(db);
      if (refused) return refused;
      const prompt = aiOf(db).prompts.find((entry) => entry.id === request.params['id']);
      if (!prompt) return notFound('Prompt');
      prompt.override = null;
      changed(db, 'ai.prompt.reset', prompt.id);
      return ok();
    },
  },
  {
    method: 'GET',
    pattern: `${ADMIN}/prompts/:id/diff`,
    handle: (request, db) => {
      const refused = denied(db);
      if (refused) return refused;
      const prompt = aiOf(db).prompts.find((entry) => entry.id === request.params['id']);
      if (!prompt) return notFound('Prompt');
      const after = prompt.override?.template ?? prompt.defaultTemplate;
      return ok({ id: prompt.id, lines: diffLines(prompt.defaultTemplate, after) });
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/ai/status',
    handle: (_, db) => {
      const ai = aiOf(db);
      const enabled = workspaceAiOn(db);
      const optedOut = Boolean(db.signedInAs && ai.optedOut.includes(db.signedInAs));
      return ok({
        enabled,
        optedOut,
        optOutAllowed: ai.settings.privacy.perUserOptOutAllowed,
        ghostText: !(db.signedInAs && ai.ghostTextOff?.includes(db.signedInAs)),
        allowActions: ai.settings.privacy.allowActions,
        availableRoles:
          enabled && aiEnabledFor(db, db.signedInAs)
            ? AI_ROLES.filter((role) => ai.roles[role] && !isPaused(db, role))
            : [],
        budgetState: budgetStatus(db).state,
      });
    },
  },
  {
    method: 'PUT',
    pattern: '/api/v1/ai/preferences',
    handle: (request, db) => {
      const parsed = parse(aiPreferencesBodySchema, request);
      if (parsed.refused) return parsed.refused;
      const ai = aiOf(db);
      const me = db.signedInAs ?? '';
      if (parsed.data.optedOut && !ai.settings.privacy.perUserOptOutAllowed) {
        return fail(
          403,
          'forbidden',
          'Your admin keeps AI on for everyone. Ask them if you want it off.',
        );
      }
      if (parsed.data.ghostText !== undefined) {
        ai.ghostTextOff = (ai.ghostTextOff ?? []).filter((id) => id !== me);
        if (!parsed.data.ghostText) ai.ghostTextOff.push(me);
      }
      if (parsed.data.optedOut === undefined) return ok();
      ai.optedOut = ai.optedOut.filter((id) => id !== me);
      if (parsed.data.optedOut) ai.optedOut.push(me);
      emit(db, 'ai.changed', [me]);
      return ok();
    },
  },
];
