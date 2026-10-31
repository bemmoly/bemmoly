import type { Feature } from '../../providers/specs.ts';
import { accountKeyOf, type ZonePart } from './part.ts';

/* Each account itself, and the services turned on in it. */

const WORKLOAD_FEATURES: Feature[] = [
  'containers',
  'registry',
  'secrets',
  'metrics',
  'logging',
  'identity',
  'network',
];
const HOME_FEATURES: Feature[] = ['registry', 'builds', 'logging', 'metrics', 'identity'];

export const projectsPart: ZonePart = {
  declare(zone) {
    for (const account of zone.all) {
      const labels: Record<string, string> = account.environment
        ? { environment: account.environment.key, class: account.environment.class }
        : { purpose: account.purpose };
      // A Starter account serves a whole tier, so it is labelled by the tier.
      if (account.environments) {
        labels['environment'] = account.environment?.class === 'prod' ? 'prod' : 'nonprod';
      }
      if (account.domain) labels['domain'] = account.domain.key;
      zone.declare('account', account.externalId, account.externalId, {
        displayName: account.name,
        folder: account.folder,
        labels,
        ...(account.adopted ? { adopt: true } : {}),
      });
      const features =
        account === zone.home ? HOME_FEATURES : account.environment ? WORKLOAD_FEATURES : null;
      if (features) {
        zone.declare('service_api', 'apis', account.externalId, { features }, [
          accountKeyOf(account.externalId),
        ]);
      }
    }
  },
  describe: {
    service_api: (spec) => ({ name: 'Services', note: (spec['features'] as string[]).join(', ') }),
  },
};
