import type { CloudProvider } from '../contract.ts';
import { createGcpConnection } from './connection.ts';
import { createGcpContexts, type GcpProviderOptions } from './context.ts';
import { createGcpFrontDoor } from './front-door.ts';
import { createGkeAccess } from './gke-access.ts';
import { createGkeClusters } from './gke-clusters.ts';
import { createGkeMetrics } from './gke-metrics.ts';
import { createGkeTargets } from './gke-targets.ts';
import { createGcpLandingZone } from './landing-zone.ts';
import { createGcpMetrics } from './metrics.ts';
import { createGcpOrg } from './org.ts';
import { createGcpRegistry, createGcpSecrets } from './registry-secrets.ts';
import { createGcpRunners } from './runners.ts';
import { createGcpTargets } from './targets.ts';

/*
 * Google Cloud (architecture §15): projects in a folder, a keyless control identity and a
 * deployer per environment that every deploy acts as. Cloud Run is the default runtime; GKE
 * Autopilot, GKE Standard and attached clusters deploy through the same Kubernetes parts.
 * A front door per environment moves applications between runtimes by weight. Builds run one
 * job per machine, on Cloud Build or as a pod on a GKE Autopilot runner pool; time-boxed
 * console access and spend are designed but not built, so they say "Coming soon".
 */
export function createGcpProvider(options: GcpProviderOptions = {}): CloudProvider {
  const contexts = createGcpContexts(options);
  const gke = createGkeAccess(
    contexts,
    options.kubernetesTransport ? { kubernetesTransport: options.kubernetesTransport } : {},
  );
  const kubernetes = {
    targets: createGkeTargets(contexts, gke),
    metrics: createGkeMetrics(contexts),
  };
  return {
    id: 'gcp',
    name: 'Google Cloud',
    description: 'Projects in a folder, workload identity, no key files',
    comingSoon: ['access', 'cost'],
    connection: createGcpConnection(contexts),
    org: createGcpOrg(contexts),
    landingZone: createGcpLandingZone(contexts),
    registry: createGcpRegistry(contexts),
    secrets: createGcpSecrets(contexts),
    targets: createGcpTargets(contexts),
    metrics: createGcpMetrics(contexts),
    clusters: createGkeClusters(contexts, gke),
    frontDoor: createGcpFrontDoor(contexts, gke),
    runtimes: {
      'gke-autopilot': kubernetes,
      'gke-standard': kubernetes,
      'attached-cluster': kubernetes,
    },
    runners: createGcpRunners(
      contexts,
      options.kubernetesTransport ? { kubernetesTransport: options.kubernetesTransport } : {},
    ),
  };
}

export { gcpConnectionConfigSchema, type GcpProviderOptions } from './context.ts';
