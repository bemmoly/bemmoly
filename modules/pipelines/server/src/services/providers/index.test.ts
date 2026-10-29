import { describe, expect, it } from 'vitest';
import { createDefaultProviders, providersFromSettings } from './index.ts';

/*
 * The shipped providers, the simulate setting that swaps Google Cloud for the fake, and the
 * local setting that alone offers this machine's Docker.
 */

const settings = (values: { simulate?: boolean; local?: boolean }) => ({
  get: (async (key: string) =>
    key === 'pipelines.providers.simulate' ? values.simulate : values.local) as never,
});

describe('the default providers', () => {
  it('offer Google Cloud with every part but runners, access and cost', () => {
    const [gcp, ...rest] = createDefaultProviders({ simulate: false });
    expect(gcp?.id).toBe('gcp');
    expect(gcp?.comingSoon).toEqual(['runners', 'access', 'cost']);
    expect(gcp?.targets?.kinds).toEqual(['container-service']);
    expect(rest.map((provider) => provider.id)).toEqual(['aws', 'kubernetes', 'azure']);
  });

  it('offer this machine only when asked to', async () => {
    const ids = (list: readonly { id: string }[]) => list.map((provider) => provider.id);
    expect(ids(createDefaultProviders({ simulate: false, local: true }))).toContain('local');
    expect(ids((await providersFromSettings(settings({}))()).list())).not.toContain('local');
    expect(ids((await providersFromSettings(undefined)()).list())).not.toContain('local');
    const local = await providersFromSettings(settings({ local: true }))();
    expect(local.get('local').targets).toBeDefined();
  });

  it('use the in-memory cloud while the simulate setting is on, keeping its state', async () => {
    const simulated = await providersFromSettings(settings({ simulate: true }))();
    const gcp = simulated.get('gcp');
    expect(gcp.name).toBe('Google Cloud');
    expect(gcp.description).toMatch(/^Simulated/);
    expect(gcp.runners).toBeDefined();
    const same = providersFromSettings(settings({ simulate: true }));
    expect(await same()).toBe(await same());
    expect(
      (await providersFromSettings(settings({ simulate: false }))()).get('gcp').runners,
    ).toBeUndefined();
  });
});
