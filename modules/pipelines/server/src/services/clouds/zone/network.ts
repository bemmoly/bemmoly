import { apisOf, type ZonePart } from './part.ts';

/* A network per workload account, so services and clusters have somewhere to sit. */

export const networkPart: ZonePart = {
  declare(zone) {
    for (const account of zone.workloads) {
      zone.declare('network', 'bemmoly', account.externalId, { name: 'bemmoly', subnets: 'auto' }, [
        apisOf(account.externalId),
      ]);
    }
  },
  describe: {
    network: (spec) => ({
      name: 'Network',
      note: `${String(spec['name'])}, ${String(spec['subnets'])} subnets`,
    }),
  },
};
