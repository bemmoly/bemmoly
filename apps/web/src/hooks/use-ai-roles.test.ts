import type { AiCatalogModelEntry } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import { parseBudget } from '../components/ai/budget-section.tsx';
import { contextLine, formatCount, priceLine, releaseLine } from '../lib/ai-format.ts';
import { eligibleFor, optionValue, parseOption, suggestedModel } from './use-ai-roles.ts';

const model = (id: string, patch: Partial<AiCatalogModelEntry> = {}): AiCatalogModelEntry => ({
  id,
  name: id,
  family: null,
  toolCall: false,
  structuredOutput: false,
  reasoning: false,
  attachment: false,
  contextWindow: 128_000,
  maxOutput: null,
  inputCostPerMillion: 1,
  outputCostPerMillion: 2,
  releaseDate: '2026-02-01',
  deprecated: false,
  eligibleRoles: ['fast', 'standard'],
  suggestedFor: [],
  ...patch,
});

const entry = (m: AiCatalogModelEntry) => ({ providerId: 'p1', providerName: 'P', model: m });

describe('model roles', () => {
  it('lists only models that qualify, keeping a deprecated one only while it is chosen', () => {
    const tools = model('tools', { toolCall: true, eligibleRoles: ['fast', 'standard', 'strong'] });
    const old = model('old', { deprecated: true, eligibleRoles: ['fast', 'standard', 'strong'] });
    const models = [entry(model('plain')), entry(tools), entry(old)];
    expect(eligibleFor('strong', models).map((e) => e.model.id)).toEqual(['tools']);
    const current = { providerId: 'p1', model: 'old' } as Parameters<typeof eligibleFor>[2];
    expect(eligibleFor('strong', models, current).map((e) => e.model.id)).toEqual(['tools', 'old']);
  });

  it('prefers the catalog’s suggestion, then the first model that fits', () => {
    const a = model('a');
    const b = model('b', { suggestedFor: ['fast'] });
    expect(suggestedModel('fast', [a, b])?.id).toBe('b');
    expect(suggestedModel('standard', [a, b])?.id).toBe('a');
    expect(suggestedModel('embedding', [a, b])).toBeNull();
  });

  it('round-trips a provider and a model id with colons in it', () => {
    const value = optionValue('p1', 'org/model:free');
    expect(parseOption(value)).toEqual({ providerId: 'p1', model: 'org/model:free' });
  });
});

describe('the numbers admins compare models by', () => {
  it('says context, price and release in words', () => {
    expect(contextLine(200_000)).toBe('200K context');
    expect(contextLine(1_000_000)).toBe('1M context');
    expect(contextLine(null)).toBeNull();
    expect(priceLine(3, 15)).toBe('$3 in · $15 out per M tokens');
    expect(priceLine(0, 0)).toBe('Free');
    expect(priceLine(null, null)).toBeNull();
    expect(releaseLine('2026-02-14')).toBe('Released Feb 2026');
    expect(formatCount(1_469_000)).toBe('1.5M');
    expect(formatCount(27_280)).toBe('27K');
    expect(formatCount(612)).toBe('612');
  });

  it('reads a typed budget, empty meaning no limit', () => {
    expect(parseBudget('')).toEqual({ value: null });
    expect(parseBudget('$1,250.5')).toEqual({ value: 1250.5 });
    expect(parseBudget('-3')).toHaveProperty('error');
    expect(parseBudget('lots')).toHaveProperty('error');
  });
});
