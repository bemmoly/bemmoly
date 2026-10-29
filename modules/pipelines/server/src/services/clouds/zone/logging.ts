import { apisOf, type ZonePart } from './part.ts';

/* How long logs are kept: longer in production, where they are evidence. */

export const loggingPart: ZonePart = {
  declare(zone) {
    zone.declare('logging', 'logs', zone.home.externalId, { retentionDays: 30 }, [
      apisOf(zone.home.externalId),
    ]);
    for (const account of zone.workloads) {
      const prod = account.environment?.class === 'prod';
      zone.declare('logging', 'logs', account.externalId, { retentionDays: prod ? 90 : 30 }, [
        apisOf(account.externalId),
      ]);
    }
  },
  describe: {
    logging: (spec) => ({ name: 'Logs', note: `kept ${String(spec['retentionDays'])} days` }),
  },
};
