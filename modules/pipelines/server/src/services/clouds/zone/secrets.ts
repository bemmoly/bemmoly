import { keyOf } from '../order.ts';
import type { ZonePart } from './part.ts';

/* Secrets stay in the account that uses them, readable by its runtime identity alone. */

export const secretsPart: ZonePart = {
  declare(zone) {
    for (const account of zone.workloads) {
      const id = account.externalId;
      zone.declare('secret_store', 'secrets', id, { readers: ['runtime'] }, [
        keyOf({ kind: 'runtime_identity', name: 'runtime', account: id }),
      ]);
    }
  },
  describe: {
    secret_store: (spec) => ({
      name: 'Secret store',
      note: `readable by ${(spec['readers'] as string[]).join(', ')}`,
    }),
  },
};
