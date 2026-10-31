import { createHash } from 'node:crypto';
import type { GcpPathMatcher, GcpUrlMap } from '../../../clients/gcp/load-balancing.ts';

/*
 * The names a front door's resources take, and the URL map it writes. Compute names are 63
 * characters at most, a lowercase letter first, so a name that would run longer keeps its
 * start and ends in a short hash of the whole. A GKE revision's backend service is named
 * "fd-<namespace>-<revision>-80", so the canary metrics that find a Gateway's backend by
 * "-<namespace>-<revision>-" find the front door's too.
 */

const MAX = 63;

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');

const hash = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 8);

export function computeName(...parts: string[]): string {
  const whole = slug(parts.join('-'));
  const named = /^[a-z]/.test(whole) ? whole : `bm-${whole}`;
  if (named.length <= MAX) return named;
  return `${named.slice(0, MAX - 9).replace(/-+$/, '')}-${hash(named)}`;
}

export const frontDoorNames = (environment: string) => ({
  address: computeName('bm-fd', environment),
  urlMap: computeName('bm-fd', environment),
  proxy: computeName('bm-fd', environment),
  rule: computeName('bm-fd', environment),
  healthCheck: computeName('bm-fd', environment, 'neg'),
});

/** Cloud Run's serverless NEG lives in the service's region and names only the service. */
export const cloudRunGroupName = (application: string) => computeName('bm-run', application);
export const cloudRunBackendName = (environment: string, application: string) =>
  computeName('bm', environment, application, 'run');

export const gkeBackendName = (namespace: string, revision: string) =>
  computeName('fd', namespace, revision, '80');

/** One certificate per host, so adding a host never reissues another host's certificate. */
export const certificateName = (host: string) => computeName('bm-fd', hash(host), host);

export const matcherName = (host: string) => computeName('h', host);

/** The last segment of a resource link, which is how links compare across hostnames. */
export const nameOf = (link: string) => link.slice(link.lastIndexOf('/') + 1);

export interface WeightedLink {
  link: string;
  weight: number;
}

/** The backend services a host's matcher sends traffic to now. */
export function linksOfHost(map: GcpUrlMap | null, host: string): string[] {
  const rule = map?.hostRules.find((entry) => entry.hosts.includes(host));
  const matcher = map?.pathMatchers.find((entry) => entry.name === rule?.pathMatcher);
  return (matcher?.defaultRouteAction?.weightedBackendServices ?? []).map(
    (entry) => entry.backendService,
  );
}

export type UrlMapBody = {
  name: string;
  fingerprint?: string;
  defaultService: string;
  hostRules: GcpUrlMap['hostRules'];
  pathMatchers: GcpPathMatcher[];
};

/**
 * The URL map with one host's matcher replaced. Its default service is the heaviest backend
 * of the first host, since Google requires one; requests for no known host are sent there.
 */
export function withHost(
  map: GcpUrlMap | null,
  name: string,
  host: string,
  weights: readonly WeightedLink[],
): UrlMapBody {
  const matcher: GcpPathMatcher = {
    name: matcherName(host),
    defaultRouteAction: {
      weightedBackendServices: weights.map((entry) => ({
        backendService: entry.link,
        weight: entry.weight,
      })),
    },
  };
  const hostRules = [
    ...(map?.hostRules ?? []).filter((rule) => !rule.hosts.includes(host)),
    { hosts: [host], pathMatcher: matcher.name },
  ].sort((a, b) => (a.hosts[0] ?? '').localeCompare(b.hosts[0] ?? ''));
  const pathMatchers = [
    ...(map?.pathMatchers ?? []).filter((entry) => entry.name !== matcher.name),
    matcher,
  ].sort((a, b) => a.name.localeCompare(b.name));
  const first = pathMatchers.find((entry) => entry.name === hostRules[0]?.pathMatcher);
  const heaviest = [...(first?.defaultRouteAction?.weightedBackendServices ?? [])].sort(
    (a, b) => b.weight - a.weight,
  )[0];
  return {
    name,
    ...(map?.fingerprint ? { fingerprint: map.fingerprint } : {}),
    defaultService: heaviest?.backendService ?? weights[0]?.link ?? '',
    hostRules,
    pathMatchers,
  };
}
