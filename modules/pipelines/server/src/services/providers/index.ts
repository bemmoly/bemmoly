import type { SettingsRegistry } from '@bemmoly/core';
import { awsProvider } from './aws.ts';
import type { CloudProvider } from './contract.ts';
import { simulatedFacts } from './fake/export.ts';
import { createFakeProvider, createFakeWorld, type FakeWorld } from './fake/index.ts';
import { exportFiles } from './gcp/export/index.ts';
import { createGcpProvider, type GcpProviderOptions } from './gcp/index.ts';
import { createLocalProvider } from './local/index.ts';
import { comingSoonProvider, createProviderRegistry, type ProviderRegistry } from './registry.ts';

/*
 * The providers Pipelines ships with, in the order Platform › Clouds shows them. Adding a
 * cloud is one implementation plus one line here. With pipelines.providers.simulate on, the
 * Google Cloud slot is the in-memory provider, so a demo or a test install runs every flow
 * without touching a real cloud.
 */

export interface DefaultProvidersOptions {
  simulate: boolean;
  /** The simulated cloud's state, shared across calls so a demo's deploys persist. */
  world?: FakeWorld;
  gcp?: GcpProviderOptions;
}

function simulatedGcp(world: FakeWorld | undefined): CloudProvider {
  return {
    ...createFakeProvider(world, 'gcp'),
    name: 'Google Cloud',
    description: 'Simulated: nothing is created in Google Cloud',
    // Google Cloud's own files, with facts the simulator makes up from the names.
    export: { files: exportFiles, read: async (_connection, records) => simulatedFacts(records) },
  };
}

export function createDefaultProviders(options: DefaultProvidersOptions): CloudProvider[] {
  return [
    options.simulate ? simulatedGcp(options.world) : createGcpProvider(options.gcp),
    awsProvider,
    comingSoonProvider('kubernetes', 'Kubernetes', 'Any cluster: namespaces per environment'),
    comingSoonProvider('azure', 'Microsoft Azure', 'Subscriptions in a management group'),
    createLocalProvider(),
  ];
}

/** Hands out the registry the simulate setting currently asks for. */
export type ProviderSource = () => Promise<ProviderRegistry>;

export function providersFromSettings(
  settings: Pick<SettingsRegistry, 'get'> | undefined,
  options: Omit<DefaultProvidersOptions, 'simulate'> = {},
): ProviderSource {
  const world = options.world ?? createFakeWorld();
  let real: ProviderRegistry | null = null;
  let simulated: ProviderRegistry | null = null;
  return async () => {
    const simulate = settings
      ? (await settings.get('pipelines.providers.simulate')) === true
      : false;
    if (simulate) {
      simulated ??= createProviderRegistry(createDefaultProviders({ ...options, world, simulate }));
      return simulated;
    }
    real ??= createProviderRegistry(createDefaultProviders({ ...options, simulate }));
    return real;
  };
}

export type { ProviderRegistry } from './registry.ts';
