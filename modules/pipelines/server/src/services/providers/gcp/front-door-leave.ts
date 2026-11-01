import {
  runServiceName,
  type LoadBalancingClient,
  type Place,
} from '../../../clients/gcp/index.ts';
import {
  backendServiceSchema,
  urlMapSchema,
  type LoadBalancerKind,
} from '../../../clients/gcp/load-balancing.ts';
import type { DeployTarget } from '../contract.ts';
import { placeOf, type GcpContexts } from './context.ts';
import { cloudRunGroupName, nameOf, type frontDoorNames } from './front-door-map.ts';
import type { GkeAccess } from './gke-access.ts';
import { LABELS, MANAGED_BY } from './gke-manifests.ts';
import { removeRevisionObjects, stableServiceOf } from './gke-scaling.ts';

/*
 * The two ends of a front door's life: leaving a runtime once a move is done (the Cloud Run
 * service, or every revision and the route on GKE), and taking a whole front door down in
 * the order Google requires, each part before what it refers to.
 */

export async function leaveRuntime(
  contexts: GcpContexts,
  gke: GkeAccess,
  target: DeployTarget,
): Promise<void> {
  const application = target.application.key;
  if ((target.placement?.runtime ?? 'cloud-run') === 'cloud-run') {
    const context = contexts(target.connection);
    const place = placeOf(target, context.config);
    const clients = context.deployer(place.projectId, place.account);
    await clients.run.deleteService(runServiceName(place.projectId, place.region, application));
    await clients.loadBalancing.remove(
      { projectId: place.projectId, region: place.region },
      'networkEndpointGroups',
      cloudRunGroupName(application),
    );
    return;
  }
  const handle = await gke.target(target);
  await handle.kube.remove('HTTPRoute', application, handle.namespace);
  const deployments = await handle.kube.list(
    'Deployment',
    handle.namespace,
    `${LABELS.application}=${application},${LABELS.managedBy}=${MANAGED_BY}`,
  );
  for (const deployment of deployments) {
    await removeRevisionObjects(
      handle.kube,
      handle.namespace,
      deployment.metadata.name,
      deployment.spec,
    );
  }
  await handle.kube.remove('Service', stableServiceOf(application), handle.namespace);
}

/** "…/regions/asia-south1/networkEndpointGroups/bm-run-shop" as a place and a name. */
function regionalGroup(link: string): { region: string; name: string } | null {
  const match = /\/regions\/([^/]+)\/networkEndpointGroups\/([^/]+)$/.exec(link);
  return match?.[1] && match[2] ? { region: match[1], name: match[2] } : null;
}

export async function removeFrontDoor(
  lb: LoadBalancingClient,
  place: Place,
  names: ReturnType<typeof frontDoorNames>,
  certificates: readonly string[],
): Promise<void> {
  const map = await lb.get(place, 'urlMaps', names.urlMap, urlMapSchema);
  const services = new Set(
    (map?.pathMatchers ?? []).flatMap((matcher) =>
      (matcher.defaultRouteAction?.weightedBackendServices ?? []).map((entry) =>
        nameOf(entry.backendService),
      ),
    ),
  );
  const groups = [];
  for (const service of services) {
    const found = await lb.get(place, 'backendServices', service, backendServiceSchema);
    for (const backend of found?.backends ?? []) {
      const regional = regionalGroup(backend.group);
      if (regional) groups.push(regional);
    }
  }
  const order: Array<[LoadBalancerKind, string]> = [
    ['forwardingRules', names.rule],
    ['targetHttpsProxies', names.proxy],
    ['targetHttpProxies', names.proxy],
    ['urlMaps', names.urlMap],
    ...[...services].map((service): [LoadBalancerKind, string] => ['backendServices', service]),
    ['healthChecks', names.healthCheck],
    ...certificates.map((name): [LoadBalancerKind, string] => ['sslCertificates', name]),
    ['addresses', names.address],
  ];
  for (const [kind, name] of order) await lb.remove(place, kind, name);
  for (const group of groups) {
    await lb.remove({ ...place, region: group.region }, 'networkEndpointGroups', group.name);
  }
}
