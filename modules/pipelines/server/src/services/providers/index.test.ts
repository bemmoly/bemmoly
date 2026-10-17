import { describe, expect, it } from 'vitest';
import { createDefaultProviders, providersFromSettings } from './index.ts';

/* The shipped providers and the simulate setting that swaps Google Cloud for the fake. */

const settings = (simulate: boolean) => ({ get: (async () => simulate) as never });

describe('the default providers', () => {
  it('offer Google Cloud with every part but runners, access and cost', () => {
    const [gcp, ...rest] = createDefaultProviders({ simulate: false });
    expect(gcp?.id).toBe('gcp');
    expect(gcp?.comingSoon).toEqual(['runners', 'access', 'cost']);
    expect(gcp?.targets?.kinds).toEqual(['container-service']);
    expect(rest.map((provider) => provider.id)).toEqual(['aws', 'kubernetes', 'azure', 'local']);
  });

  it('use the in-memory cloud while the simulate setting is on, keeping its state', async () => {
    const simulated = await providersFromSettings(settings(true))();
    const gcp = simulated.get('gcp');
    expect(gcp.name).toBe('Google Cloud');
    expect(gcp.description).toMatch(/^Simulated/);
    expect(gcp.runners).toBeDefined();
    const source = providersFromSettings(settings(true));
    expect(await source()).toBe(await source());
    expect((await providersFromSettings(settings(false))()).get('gcp').runners).toBeUndefined();
  });
});
