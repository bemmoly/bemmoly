import type { CloudProvider } from '../contract.ts';
import { createGcpConnection } from './connection.ts';
import { createGcpContexts, type GcpProviderOptions } from './context.ts';
import { createGcpLandingZone } from './landing-zone.ts';
import { createGcpMetrics } from './metrics.ts';
import { createGcpOrg } from './org.ts';
import { createGcpRegistry, createGcpSecrets } from './registry-secrets.ts';
import { createGcpTargets } from './targets.ts';

/*
 * Google Cloud (architecture §15): projects in a folder, a keyless control identity and a
 * deployer per environment that every deploy acts as. Runner pools, time-boxed console
 * access and spend are designed but not built, so they say "Coming soon".
 */
export function createGcpProvider(options: GcpProviderOptions = {}): CloudProvider {
  const contexts = createGcpContexts(options);
  return {
    id: 'gcp',
    name: 'Google Cloud',
    description: 'Projects in a folder, workload identity, no key files',
    comingSoon: ['runners', 'access', 'cost'],
    connection: createGcpConnection(contexts),
    org: createGcpOrg(contexts),
    landingZone: createGcpLandingZone(contexts),
    registry: createGcpRegistry(contexts),
    secrets: createGcpSecrets(contexts),
    targets: createGcpTargets(contexts),
    metrics: createGcpMetrics(contexts),
  };
}

export { gcpConnectionConfigSchema, type GcpProviderOptions } from './context.ts';
