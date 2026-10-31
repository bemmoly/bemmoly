import { keyOf } from '../order.ts';
import { REGISTRY, apisOf, registryKeyOf, type ZonePart } from './part.ts';

/*
 * One shared registry (journeys proposal, "Registry and storage"): images are built once,
 * pushed by the builder and deployed everywhere by digest. Every workload account may pull
 * from it and none may push.
 */

export const registryPart: ZonePart = {
  declare(zone) {
    const home = zone.home.externalId;
    const builder = keyOf({ kind: 'runtime_identity', name: 'builder', account: home });
    zone.declare(
      'registry_access',
      REGISTRY,
      home,
      {
        registryAccount: home,
        repository: REGISTRY,
        region: zone.config.region,
        access: 'push',
        identity: 'builder',
      },
      [builder],
    );
    for (const account of zone.workloads) {
      zone.declare(
        'registry_access',
        REGISTRY,
        account.externalId,
        {
          registryAccount: home,
          repository: REGISTRY,
          region: zone.config.region,
          access: 'pull',
          identity: 'runtime',
        },
        [apisOf(account.externalId), registryKeyOf(home)],
      );
    }
  },
  describe: {
    registry_access: (spec) =>
      spec['access'] === 'push'
        ? { name: 'Registry', note: `${String(spec['repository'])} in ${String(spec['region'])}` }
        : { name: 'Registry pull', note: `from ${String(spec['registryAccount'])}` },
  },
};
