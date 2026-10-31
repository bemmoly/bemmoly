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
 * without touching a real cloud. The local provider is there only with
 * pipelines.providers.local on: it drives the Docker socket of the machine the server runs on.
 */

export interface DefaultProvidersOptions {
  simulate: boolean;
  /** Offers "This machine" (the local Docker provider); off unless a demo turns it on. */
  local?: boolean;
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
    ...(options.local ? [createLocalProvider()] : []),
  ];
}

/** Hands out the registry the simulate and local settings currently ask for. */
export type ProviderSource = () => Promise<ProviderRegistry>;

export function providersFromSettings(
  settings: Pick<SettingsRegistry, 'get'> | undefined,
  options: Omit<DefaultProvidersOptions, 'simulate' | 'local'> = {},
): ProviderSource {
  const world = options.world ?? createFakeWorld();
  // One registry per combination, so the simulated cloud keeps its state across calls.
  const built = new Map<string, ProviderRegistry>();
  const on = async (key: 'pipelines.providers.simulate' | 'pipelines.providers.local') =>
    settings ? (await settings.get(key)) === true : false;
  return async () => {
    const simulate = await on('pipelines.providers.simulate');
    const local = await on('pipelines.providers.local');
    const key = `${simulate}:${local}`;
    let registry = built.get(key);
    if (!registry) {
      registry = createProviderRegistry(
        createDefaultProviders({ ...options, ...(simulate ? { world } : {}), simulate, local }),
      );
      built.set(key, registry);
    }
    return registry;
  };
}

export type { ProviderRegistry } from './registry.ts';
