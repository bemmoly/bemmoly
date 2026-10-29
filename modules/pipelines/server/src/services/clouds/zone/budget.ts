import { accountKeyOf, type ZonePart } from './part.ts';

/* A monthly budget with alerts, for the environment classes the connection set one for. */

export const budgetPart: ZonePart = {
  declare(zone) {
    for (const account of zone.workloads) {
      const environment = account.environment;
      const monthly = environment ? zone.config.monthlyBudgets[environment.class] : undefined;
      if (!monthly) continue;
      zone.declare(
        'budget',
        'monthly',
        account.externalId,
        { monthly, currency: zone.config.currency, alerts: [0.5, 0.9, 1] },
        [accountKeyOf(account.externalId)],
      );
    }
  },
  describe: {
    budget: (spec) => ({
      name: 'Budget',
      note: `${String(spec['monthly'])} ${String(spec['currency'])} a month`,
    }),
  },
};
