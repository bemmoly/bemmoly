import type { ExportFrontDoor, ExportFrontDoorHost } from '../../export-contract.ts';
import { certificateName, frontDoorNames, matcherName } from '../front-door-map.ts';
import { attr, block, comment, list, num, str } from './hcl.ts';
import { few } from '../../../../utils/few.ts';
import type { Terraform } from './terraform-context.ts';

/*
 * Each environment's front door, as front-door.ts makes it in each project: the reserved
 * address, the forwarding rule and proxy, managed certificates when it has a domain, the URL
 * map with a host per application and its weighted backend services, Cloud Run's serverless
 * endpoint groups and the health check GKE's backends share. GKE makes a revision's zonal
 * endpoint groups itself from its Service's annotation, so they are read, not declared. A
 * host a move or canary is still shifting is exported at its heaviest backend alone.
 */

import {
  cloudRunBackend,
  gkeBackend,
  globalId,
  SCHEME,
  settled,
} from './terraform-front-door-backends.ts';
function hostMatcher(
  tf: Terraform,
  door: ExportFrontDoor,
  region: string,
  host: ExportFrontDoorHost,
) {
  const weighted = settled(host).flatMap((share) => {
    const name =
      share.runtime === 'cloud-run'
        ? cloudRunBackend(tf, door, region, host.application)
        : share.revision
          ? gkeBackend(tf, door, host.namespace, share.revision)
          : null;
    return name ? [{ name, weight: share.percent }] : [];
  });
  return {
    host: host.host,
    matcher: matcherName(host.host),
    weighted,
    item: block(
      'path_matcher',
      [],
      [
        attr('name', str(matcherName(host.host))),
        block(
          'default_route_action',
          [],
          weighted.map((share) =>
            block(
              'weighted_backend_services',
              [],
              [
                attr('backend_service', `google_compute_backend_service.${share.name}.id`),
                attr('weight', num(share.weight)),
              ],
            ),
          ),
        ),
      ],
    ),
  };
}

function frontDoor(tf: Terraform, door: ExportFrontDoor) {
  const names = frontDoorNames(door.environment);
  const region = door.region ?? String(tf.records.connection.config['region'] ?? 'us-central1');
  const project = attr('project', tf.projectRef(door.account));
  const prefix = `${door.environment}_${door.account}`;
  tf.addItems('front-door.tf', [comment(`${door.environment}'s front door in ${door.account}.`)]);
  const address = tf.unique('google_compute_global_address', prefix);
  tf.add('front-door.tf', {
    type: 'google_compute_global_address',
    name: address,
    body: [
      project,
      attr('name', str(names.address)),
      attr('address_type', str('EXTERNAL')),
      attr('ip_version', str('IPV4')),
    ],
    importId: globalId(tf, door.account, 'addresses', names.address),
  });
  const hosts = [...door.hosts]
    .sort((a, b) => a.host.localeCompare(b.host))
    .map((host) => hostMatcher(tf, door, region, host));
  const first = [...(hosts[0]?.weighted ?? [])].sort((a, b) => b.weight - a.weight)[0];
  const urlMap = tf.unique('google_compute_url_map', prefix);
  tf.add('front-door.tf', {
    type: 'google_compute_url_map',
    name: urlMap,
    body: [
      project,
      attr('name', str(names.urlMap)),
      ...(first
        ? [attr('default_service', `google_compute_backend_service.${first.name}.id`)]
        : []),
      ...hosts.map((host) =>
        block(
          'host_rule',
          [],
          [attr('hosts', list([str(host.host)])), attr('path_matcher', str(host.matcher))],
        ),
      ),
      ...[...hosts].sort((a, b) => a.matcher.localeCompare(b.matcher)).map((host) => host.item),
    ],
    importId: globalId(tf, door.account, 'urlMaps', names.urlMap),
  });
  const certificates = door.domain
    ? hosts.map((host) => {
        const name = certificateName(host.host);
        const cert = tf.unique('google_compute_managed_ssl_certificate', `${prefix}_${host.host}`);
        tf.add('front-door.tf', {
          type: 'google_compute_managed_ssl_certificate',
          name: cert,
          body: [
            project,
            attr('name', str(name)),
            block('managed', [], [attr('domains', list([str(host.host)]))]),
          ],
          importId: globalId(tf, door.account, 'sslCertificates', name),
        });
        return `google_compute_managed_ssl_certificate.${cert}.id`;
      })
    : null;
  const proxyType = certificates
    ? 'google_compute_target_https_proxy'
    : 'google_compute_target_http_proxy';
  const proxy = tf.unique(proxyType, prefix);
  tf.add('front-door.tf', {
    type: proxyType,
    name: proxy,
    body: [
      project,
      attr('name', str(names.proxy)),
      attr('url_map', `google_compute_url_map.${urlMap}.id`),
      ...(certificates ? [attr('ssl_certificates', list(certificates))] : []),
    ],
    importId: globalId(
      tf,
      door.account,
      certificates ? 'targetHttpsProxies' : 'targetHttpProxies',
      names.proxy,
    ),
  });
  tf.add('front-door.tf', {
    type: 'google_compute_global_forwarding_rule',
    name: tf.unique('google_compute_global_forwarding_rule', prefix),
    body: [
      project,
      attr('name', str(names.rule)),
      attr('ip_address', `google_compute_global_address.${address}.address`),
      attr('ip_protocol', str('TCP')),
      attr('port_range', str(certificates ? '443' : '80')),
      attr('target', `${proxyType}.${proxy}.id`),
      attr('load_balancing_scheme', str(SCHEME)),
    ],
    importId: globalId(tf, door.account, 'forwardingRules', names.rule),
  });
}

export function frontDoors(tf: Terraform): void {
  for (const door of tf.records.frontDoors) frontDoor(tf, door);
  const shifting = tf.records.frontDoors.flatMap((door) =>
    door.hosts.filter((host) => host.moving).map((host) => `${host.host} in ${door.environment}`),
  );
  if (shifting.length > 0) {
    tf.fill.push(
      `Traffic is still shifting on ${few(shifting)}, so each is exported with all of it on the backend that takes most now. A plan shows the weights changing; apply once the move or canary ends.`,
    );
  }
}
