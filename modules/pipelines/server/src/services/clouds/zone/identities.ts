import { apisOf, type ZonePart } from './part.ts';

/*
 * Who acts where. The builder lives beside the registry and can push to it and nothing else;
 * each workload account has its own deployer, which every deploy there acts as, and the
 * runtime identity its services run as. None of them has a key.
 */

export const identitiesPart: ZonePart = {
  declare(zone) {
    const home = zone.home.externalId;
    zone.declare('runtime_identity', 'builder', home, { name: 'builder', purpose: 'build' }, [
      apisOf(home),
    ]);
    for (const account of zone.workloads) {
      const id = account.externalId;
      zone.declare('deployer_identity', 'deployer', id, { name: 'deployer' }, [apisOf(id)]);
      zone.declare('runtime_identity', 'runtime', id, { name: 'runtime', purpose: 'runtime' }, [
        apisOf(id),
      ]);
    }
  },
  describe: {
    deployer_identity: () => ({ name: 'Deployer identity', note: 'every deploy acts as it' }),
    runtime_identity: (spec) =>
      spec['purpose'] === 'build'
        ? { name: 'Build identity', note: 'pushes images to the registry' }
        : { name: 'Runtime identity', note: 'what applications run as' },
  },
};
