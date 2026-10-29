import { z } from 'zod';
import {
  COMPUTE_BASE,
  computeOperationSchema,
  waitForComputeOperation,
  type ComputeOperation,
} from './compute.ts';
import { GcpApiError, type GcpHttp } from './http.ts';
import type { PollOptions } from './operations.ts';

/*
 * Compute Engine v1, the parts of a global external Application Load Balancer: a reserved
 * address, network endpoint groups (serverless for Cloud Run, zonal for GKE's standalone
 * NEGs), health checks, backend services, the URL map whose weighted backend services carry
 * a split, target HTTP and HTTPS proxies, forwarding rules and Google-managed certificates.
 * Each kind is read, created, replaced and deleted the same way; every write waits for its
 * operation, and a delete of something already gone counts as done.
 */

export type LoadBalancerKind =
  | 'addresses'
  | 'healthChecks'
  | 'backendServices'
  | 'urlMaps'
  | 'targetHttpsProxies'
  | 'targetHttpProxies'
  | 'forwardingRules'
  | 'sslCertificates'
  | 'networkEndpointGroups';

const baseSchema = z.object({
  name: z.string(),
  selfLink: z.string().optional(),
  fingerprint: z.string().optional(),
});

export const addressSchema = baseSchema.extend({
  address: z.string().optional(),
  status: z.string().optional(),
});

export const backendServiceSchema = baseSchema.extend({
  backends: z.array(z.object({ group: z.string() }).loose()).default([]),
});

const weightedSchema = z.object({ backendService: z.string(), weight: z.number() });

export const pathMatcherSchema = z.object({
  name: z.string(),
  defaultService: z.string().optional(),
  defaultRouteAction: z
    .object({ weightedBackendServices: z.array(weightedSchema).default([]) })
    .optional(),
});

export const urlMapSchema = baseSchema.extend({
  defaultService: z.string().optional(),
  hostRules: z.array(z.object({ hosts: z.array(z.string()), pathMatcher: z.string() })).default([]),
  pathMatchers: z.array(pathMatcherSchema).default([]),
});

export const proxySchema = baseSchema.extend({
  urlMap: z.string().optional(),
  sslCertificates: z.array(z.string()).default([]),
});

export const forwardingRuleSchema = baseSchema.extend({
  IPAddress: z.string().optional(),
  target: z.string().optional(),
  portRange: z.string().optional(),
});

export const certificateSchema = baseSchema.extend({
  managed: z
    .object({
      domains: z.array(z.string()).default([]),
      status: z.string().optional(),
      domainStatus: z.record(z.string(), z.string()).default({}),
    })
    .optional(),
});

const negSchema = baseSchema.extend({ zone: z.string().optional(), size: z.number().optional() });

const aggregatedNegsSchema = z.object({
  items: z
    .record(z.string(), z.object({ networkEndpointGroups: z.array(negSchema).default([]) }).loose())
    .default({}),
});

export type GcpUrlMap = z.infer<typeof urlMapSchema>;
export type GcpPathMatcher = z.infer<typeof pathMatcherSchema>;
export type GcpBackendService = z.infer<typeof backendServiceSchema>;
export type GcpProxy = z.infer<typeof proxySchema>;
export type GcpForwardingRule = z.infer<typeof forwardingRuleSchema>;
export type GcpCertificate = z.infer<typeof certificateSchema>;
export type GcpAddress = z.infer<typeof addressSchema>;

/** Where a kind lives: global, or in a region (serverless NEGs). */
export interface Place {
  projectId: string;
  region?: string;
}

const collectionOf = (place: Place, kind: LoadBalancerKind) =>
  `${COMPUTE_BASE}/projects/${place.projectId}/${place.region ? `regions/${place.region}` : 'global'}/${kind}`;

/** The link other resources name this one by. */
export const linkOf = (place: Place, kind: LoadBalancerKind, name: string) =>
  `${collectionOf(place, kind)}/${name}`;

export function createLoadBalancingClient(http: GcpHttp, poll: PollOptions) {
  const wait = (place: Place, operation: ComputeOperation, what: string) =>
    waitForComputeOperation(http, poll, place.projectId, operation, what);

  async function write(
    place: Place,
    what: string,
    request: { method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'; url: string; body?: unknown },
  ) {
    const operation = await http.send({ ...request, schema: computeOperationSchema });
    await wait(place, operation, what);
  }

  return {
    get<T>(place: Place, kind: LoadBalancerKind, name: string, schema: z.ZodType<T>) {
      return http.find({ url: linkOf(place, kind, name), schema });
    },

    insert(place: Place, kind: LoadBalancerKind, body: { name: string } & Record<string, unknown>) {
      return write(place, `${body.name}`, {
        method: 'POST',
        url: collectionOf(place, kind),
        body,
      });
    },

    /** Replaces it whole; the body carries the fingerprint it was read with. */
    replace(place: Place, kind: LoadBalancerKind, name: string, body: Record<string, unknown>) {
      return write(place, name, { method: 'PUT', url: linkOf(place, kind, name), body });
    },

    patch(place: Place, kind: LoadBalancerKind, name: string, body: Record<string, unknown>) {
      return write(place, name, { method: 'PATCH', url: linkOf(place, kind, name), body });
    },

    async remove(place: Place, kind: LoadBalancerKind, name: string): Promise<void> {
      try {
        await write(place, name, { method: 'DELETE', url: linkOf(place, kind, name) });
      } catch (error) {
        if (error instanceof GcpApiError && error.status === 404) return;
        throw error;
      }
    },

    /** Which certificates an HTTPS proxy presents, in order. */
    setCertificates(place: Place, proxy: string, certificates: readonly string[]) {
      return write(place, proxy, {
        method: 'POST',
        url: `${COMPUTE_BASE}/projects/${place.projectId}/targetHttpsProxies/${proxy}/setSslCertificates`,
        body: { sslCertificates: certificates },
      });
    },

    /** Every zonal NEG with this name, as GKE makes one per zone the Service's pods run in. */
    async zonalGroups(projectId: string, name: string): Promise<string[]> {
      const found = await http.send({
        url: `${COMPUTE_BASE}/projects/${projectId}/aggregated/networkEndpointGroups`,
        query: { filter: `name = "${name}"` },
        schema: aggregatedNegsSchema,
      });
      return Object.values(found.items)
        .flatMap((scope) => scope.networkEndpointGroups)
        .filter((group) => group.name === name && group.zone)
        .map((group) => group.selfLink ?? '')
        .filter(Boolean)
        .sort();
    },
  };
}

export type LoadBalancingClient = ReturnType<typeof createLoadBalancingClient>;
