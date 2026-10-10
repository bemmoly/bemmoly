import {
  aiCatalogProviderResponseSchema,
  aiCatalogResponseSchema,
  aiModelRolesResponseSchema,
  aiProviderSchema,
  aiProviderTestResponseSchema,
  aiSettingsResponseSchema,
  aiStatusResponseSchema,
  aiUsageResponseSchema,
  meResponseSchema,
} from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import { createMockApi } from '../dispatch.ts';

/* The AI mock answers Settings › AI as the runtime's admin API does, and drives aiEnabled. */

const ADMIN = 'http://mock.local/api/v1/admin/ai';
type Api = ReturnType<typeof createMockApi>;

const call = (api: Api, method: string, path: string, body?: unknown) =>
  api.dispatch(method, path.startsWith('http') ? path : `${ADMIN}${path}`, body);
const me = (api: Api) =>
  meResponseSchema.parse(call(api, 'GET', 'http://mock.local/api/v1/me')?.body);

describe('the AI mock', () => {
  it('starts a set-up install with AI on, one provider and every role filled', () => {
    const api = createMockApi('ready');
    const settings = aiSettingsResponseSchema.parse(call(api, 'GET', '/settings')?.body);
    expect(settings.privacy.enabled).toBe(true);
    const roles = aiModelRolesResponseSchema.parse(call(api, 'GET', '/roles')?.body);
    expect(roles.items.every((item) => item.assignment !== null)).toBe(true);
    expect(me(api).workspace.aiEnabled).toBe(true);
    expect(aiUsageResponseSchema.parse(call(api, 'GET', '/usage')?.body).budget.state).toBe('ok');
  });

  it('turns every AI surface off with the switch and keeps the providers', () => {
    const api = createMockApi('ready');
    call(api, 'PATCH', '/settings', { privacy: { enabled: false } });
    expect(me(api).workspace.aiEnabled).toBe(false);
    expect(call(api, 'GET', '/providers')?.body).toMatchObject({ items: [{ status: 'ok' }] });
    expect(api.db.outbound.at(-1)?.[0]).toBe('ai.changed');
  });

  it('serves the catalog with logos and the role picker with eligibility and defaults', () => {
    const api = createMockApi('fresh');
    api.reset('ready');
    const catalog = aiCatalogResponseSchema.parse(call(api, 'GET', '/catalog')?.body);
    expect(catalog.popular.length).toBeGreaterThan(0);
    const id = catalog.popular[0] ?? '';
    const models = aiCatalogProviderResponseSchema.parse(
      call(api, 'GET', `/catalog/providers/${id}`)?.body,
    ).models;
    expect(models.some((model) => model.suggestedFor.includes('strong'))).toBe(true);
    expect(models.filter((model) => model.eligibleRoles.includes('strong'))).toSatisfy(
      (list: typeof models) => list.every((model) => model.toolCall),
    );
  });

  it('reports a refused key in the provider’s own words, and connects a Local server', () => {
    const api = createMockApi('ready');
    const refused = aiProviderTestResponseSchema.parse(
      call(api, 'POST', '/provider-tests', {
        kind: 'custom',
        protocol: 'openai-compatible',
        name: 'GPU box',
        baseUrl: 'http://10.0.4.12:8000/v1',
        apiKey: 'a-bad-key',
      })?.body,
    );
    expect(refused).toMatchObject({ ok: false });
    expect(refused.message).toContain('Incorrect API key provided.');
    const local = aiProviderSchema.parse(
      call(api, 'POST', '/providers', {
        kind: 'custom',
        protocol: 'openai-compatible',
        name: 'GPU box',
        baseUrl: 'http://10.0.4.12:8000/v1',
      })?.body,
    );
    expect(local.models.map((model) => model.id)).toContain('house-embed');
    expect(
      call(api, 'PUT', '/roles/fast', { providerId: local.id, model: 'house-chat-8b' }),
    ).toEqual({
      status: 204,
    });
    expect(
      call(api, 'PUT', '/roles/strong', { providerId: local.id, model: 'house-embed' })?.status,
    ).toBe(400);
  });

  it('pauses standard and strong at 100% of the budget', () => {
    const api = createMockApi('ready');
    call(api, 'PATCH', '/settings', { budget: { monthlyBudgetUsd: 10 } });
    const usage = aiUsageResponseSchema.parse(call(api, 'GET', '/usage')?.body);
    expect(usage.budget).toMatchObject({ state: 'paused', pausedRoles: ['standard', 'strong'] });
  });

  it('lets a person opt out only while the admin allows it', () => {
    const api = createMockApi('member');
    const status = () =>
      aiStatusResponseSchema.parse(call(api, 'GET', 'http://mock.local/api/v1/ai/status')?.body);
    call(api, 'PUT', 'http://mock.local/api/v1/ai/preferences', { optedOut: true });
    expect(status()).toMatchObject({ enabled: true, optedOut: true, availableRoles: [] });
    expect(me(api).workspace.aiEnabled).toBe(false);
    api.db.ai.settings.privacy.perUserOptOutAllowed = false;
    expect(
      call(api, 'PUT', 'http://mock.local/api/v1/ai/preferences', { optedOut: true })?.status,
    ).toBe(403);
  });

  it('refuses the admin API to someone who cannot configure models', () => {
    const api = createMockApi('member');
    expect(call(api, 'GET', '/settings')?.status).toBe(403);
  });
});
