import { ProviderError } from '@bemmoly/shared';
import { z } from 'zod';
import { linkOf, type LoadBalancingClient, type Place } from '../../../clients/gcp/index.ts';
import {
  addressSchema,
  backendServiceSchema,
  certificateSchema,
  forwardingRuleSchema,
  proxySchema,
  urlMapSchema,
  type LoadBalancerKind,
} from '../../../clients/gcp/load-balancing.ts';
import type { ConnectionRecord } from '../contract.ts';
import type { FrontDoorBackend, FrontDoorPart, FrontDoorSpec } from '../front-door-contract.ts';
import { accountConfigOf, type GcpContexts } from './context.ts';
import { leaveRuntime, removeFrontDoor } from './front-door-leave.ts';
import {
  certificateName,
  cloudRunBackendName,
  cloudRunGroupName,
  frontDoorNames,
  gkeBackendName,
  linksOfHost,
  nameOf,
  withHost,
} from './front-door-map.ts';
import type { GkeAccess } from './gke-access.ts';
import { SERVICE_PORT } from './gke-manifests.ts';

/*
 * The front door on Google Cloud: a global external Application Load Balancer per
 * environment and project, with a host rule per application. Cloud Run is reached through a
 * serverless NEG on the service, so Cloud Run's own split still runs its canaries. GKE is
 * reached revision by revision through standalone NEGs, which GKE makes when a revision's
 * Service carries the cloud.google.com/neg annotation; Pipelines adds that annotation under
 * its own field manager, so the deploy's manifests stay as they were. Everything runs as the
 * environment's deployer.
 */

const FRONT_DOOR_MANAGER = 'bemmoly-front-door';
const NEG_ANNOTATION = 'cloud.google.com/neg';
/** Google's limit on certificates one HTTPS proxy presents. */
const MAX_CERTIFICATES = 15;
const SCHEME = 'EXTERNAL_MANAGED';

const named = z.object({ name: z.string() });

const sameNames = (a: readonly string[], b: readonly string[]) =>
  a.map(nameOf).sort().join() === b.map(nameOf).sort().join();

interface Opened {
  lb: LoadBalancingClient;
  place: Place;
  region: string;
  names: ReturnType<typeof frontDoorNames>;
}

/** Makes it unless it exists; true when it was made now. */
async function make(
  lb: LoadBalancingClient,
  place: Place,
  kind: LoadBalancerKind,
  body: { name: string } & Record<string, unknown>,
): Promise<boolean> {
  if (await lb.get(place, kind, body.name, named)) return false;
  await lb.insert(place, kind, body);
  return true;
}

export function createGcpFrontDoor(contexts: GcpContexts, gke: GkeAccess): FrontDoorPart {
  const open = (connection: ConnectionRecord, door: FrontDoorSpec): Opened => {
    const context = contexts(connection);
    const account = accountConfigOf(door.account.config);
    return {
      lb: context.deployer(door.account.externalId, account).loadBalancing,
      place: { projectId: door.account.externalId },
      region: door.region ?? context.config.region,
      names: frontDoorNames(door.environment),
    };
  };

  async function cloudRunBackend(opened: Opened, door: FrontDoorSpec, backend: FrontDoorBackend) {
    const { lb, place } = opened;
    const application = backend.target.application.key;
    const groupPlace = { ...place, region: backend.target.environment.region ?? opened.region };
    const group = cloudRunGroupName(application);
    await make(lb, groupPlace, 'networkEndpointGroups', {
      name: group,
      networkEndpointType: 'SERVERLESS',
      cloudRun: { service: application },
    });
    const name = cloudRunBackendName(door.environment, application);
    await make(lb, place, 'backendServices', {
      name,
      loadBalancingScheme: SCHEME,
      protocol: 'HTTP',
      backends: [{ group: linkOf(groupPlace, 'networkEndpointGroups', group) }],
    });
    return linkOf(place, 'backendServices', name);
  }

  async function gkeBackend(opened: Opened, backend: FrontDoorBackend) {
    const { lb, place, names } = opened;
    const revision = backend.revision;
    if (!revision) throw new ProviderError('A share on GKE must name its revision');
    const handle = await gke.target(backend.target);
    if (handle.record.projectId !== place.projectId) {
      throw new ProviderError(
        `The front door in ${place.projectId} cannot reach cluster ${handle.record.name} in ${handle.record.projectId}. Use a cluster in the environment's own project`,
      );
    }
    const name = gkeBackendName(handle.namespace, revision);
    const ports = { exposed_ports: { [String(SERVICE_PORT)]: { name } } };
    await handle.kube.apply(
      {
        kind: 'Service',
        metadata: {
          name: revision,
          namespace: handle.namespace,
          annotations: { [NEG_ANNOTATION]: JSON.stringify(ports) },
        },
      },
      FRONT_DOOR_MANAGER,
    );
    const groups = await lb.zonalGroups(place.projectId, name);
    if (groups.length === 0) {
      throw new ProviderError(
        `GKE is still making the endpoint group for ${revision}. It appears a minute or two after the Service, and Pipelines tries again`,
      );
    }
    await make(lb, place, 'healthChecks', {
      name: names.healthCheck,
      type: 'HTTP',
      httpHealthCheck: { portSpecification: 'USE_SERVING_PORT', requestPath: '/' },
    });
    const backends = groups.map((group) => ({
      group,
      balancingMode: 'RATE',
      maxRatePerEndpoint: 100,
    }));
    const found = await lb.get(place, 'backendServices', name, backendServiceSchema);
    if (!found) {
      await lb.insert(place, 'backendServices', {
        name,
        loadBalancingScheme: SCHEME,
        protocol: 'HTTP',
        healthChecks: [linkOf(place, 'healthChecks', names.healthCheck)],
        backends,
      });
    } else if (
      !sameNames(
        found.backends.map((b) => b.group),
        groups,
      )
    ) {
      // A zone GKE added pods in since: the backend service follows the NEGs.
      await lb.patch(place, 'backendServices', name, { backends, fingerprint: found.fingerprint });
    }
    return linkOf(place, 'backendServices', name);
  }

  /** The proxy, its certificates and the forwarding rule on the reserved address. */
  async function entry(opened: Opened, door: FrontDoorSpec, hosts: readonly string[]) {
    const { lb, place, names } = opened;
    const address = await lb.get(place, 'addresses', names.address, addressSchema);
    if (!address?.address) {
      throw new ProviderError(`The front door's address in ${place.projectId} is not reserved yet`);
    }
    const kind = door.domain ? 'targetHttpsProxies' : 'targetHttpProxies';
    const urlMap = linkOf(place, 'urlMaps', names.urlMap);
    if (door.domain) {
      if (hosts.length > MAX_CERTIFICATES) {
        throw new ProviderError(
          `A front door presents ${MAX_CERTIFICATES} certificates at most, and ${door.environment} has ${hosts.length} services. Turn the domain off to serve them over HTTP`,
        );
      }
      const certificates: string[] = [];
      for (const host of hosts) {
        const name = certificateName(host);
        await make(lb, place, 'sslCertificates', {
          name,
          type: 'MANAGED',
          managed: { domains: [host] },
        });
        certificates.push(linkOf(place, 'sslCertificates', name));
      }
      const proxy = await lb.get(place, kind, names.proxy, proxySchema);
      if (!proxy) {
        await lb.insert(place, kind, { name: names.proxy, urlMap, sslCertificates: certificates });
      } else if (!sameNames(proxy.sslCertificates, certificates)) {
        await lb.setCertificates(place, names.proxy, certificates);
      }
    } else {
      await make(lb, place, kind, { name: names.proxy, urlMap });
    }
    const target = linkOf(place, kind, names.proxy);
    const rule = await lb.get(place, 'forwardingRules', names.rule, forwardingRuleSchema);
    // Turning the domain on or off moves the rule to the other proxy: a moment without one.
    if (rule && !rule.target?.includes(`/${kind}/`)) {
      await lb.remove(place, 'forwardingRules', names.rule);
    } else if (rule) return;
    await lb.insert(place, 'forwardingRules', {
      name: names.rule,
      IPAddress: address.address,
      IPProtocol: 'TCP',
      portRange: door.domain ? '443' : '80',
      target,
      loadBalancingScheme: SCHEME,
    });
  }

  return {
    routesRevisions: ['gke-autopilot', 'gke-standard', 'attached-cluster'],
    untested: [
      'No front door has been made on a real Google Cloud project yet; its calls are checked against answers written from Google’s reference.',
      'GKE’s standalone endpoint groups beside the Gateway’s own have not been tried on a real cluster.',
      'Google’s health checkers reach GKE pods only where the cluster’s network lets 35.191.0.0/16 and 130.211.0.0/22 in.',
    ],

    async ensure(connection, door, hosts) {
      const { lb, place, names } = open(connection, door);
      await make(lb, place, 'addresses', {
        name: names.address,
        addressType: 'EXTERNAL',
        ipVersion: 'IPV4',
        networkTier: 'PREMIUM',
      });
      const address = (await lb.get(place, 'addresses', names.address, addressSchema))?.address;
      const problems: string[] = [];
      if (!door.domain || !address) return { address: address ?? null, problems };
      for (const host of hosts) {
        const found = await lb.get(
          place,
          'sslCertificates',
          certificateName(host),
          certificateSchema,
        );
        const status = found?.managed?.status ?? 'PROVISIONING';
        if (status !== 'ACTIVE') {
          problems.push(
            `The certificate for ${host} is not issued yet. Point ${host} at ${address}; Google issues it once DNS answers there`,
          );
        }
      }
      return { address, problems };
    },

    async route(connection, door, input) {
      const opened = open(connection, door);
      const { lb, place, names } = opened;
      const weights = [];
      for (const backend of input.backends) {
        const runtime = backend.target.placement?.runtime ?? 'cloud-run';
        const link =
          runtime === 'cloud-run'
            ? await cloudRunBackend(opened, door, backend)
            : await gkeBackend(opened, backend);
        weights.push({ link, weight: backend.percent });
      }
      const map = await lb.get(place, 'urlMaps', names.urlMap, urlMapSchema);
      const before = linksOfHost(map, input.host);
      const next = withHost(map, names.urlMap, input.host, weights);
      if (map) await lb.replace(place, 'urlMaps', names.urlMap, next);
      else await lb.insert(place, 'urlMaps', next);
      await entry(
        opened,
        door,
        next.hostRules.flatMap((rule) => rule.hosts),
      );
      const kept = new Set(weights.map((weight) => nameOf(weight.link)));
      for (const link of before) {
        if (!kept.has(nameOf(link))) await lb.remove(place, 'backendServices', nameOf(link));
      }
    },

    leave: (target) => leaveRuntime(contexts, gke, target),

    async remove(connection, door, hosts) {
      const opened = open(connection, door);
      await removeFrontDoor(opened.lb, opened.place, opened.names, hosts.map(certificateName));
    },
  };
}
