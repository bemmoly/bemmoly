import { ValidationError } from '@bemmoly/shared';
import { MANAGED_LABEL, ensureBilling, ensureFolder, ensureProject, folderOf } from './org.ts';
import { FEATURE_APIS, projectNumberOf, type ZoneKind } from './zone-kind.ts';

/* The project itself and what sits on it directly: APIs, network, log retention, budget. */

const wantedLabels = (labels: Readonly<Record<string, string>>) => ({
  ...labels,
  ...MANAGED_LABEL,
});

export const accountKind: ZoneKind<'account'> = {
  expected: (spec) =>
    spec.adopt
      ? { billing: true }
      : {
          displayName: spec.displayName.slice(0, 30),
          labels: wantedLabels(spec.labels),
          billing: true,
        },
  async read({ context, resource, spec }) {
    const project = await context.control.resourceManager.getProject(resource.account);
    if (!project || project.state === 'DELETE_REQUESTED') return null;
    const billing = await context.control.billing.getProjectBilling(resource.account);
    const keys = Object.keys(wantedLabels(spec.labels));
    return {
      displayName: project.displayName ?? '',
      labels: Object.fromEntries(keys.map((key) => [key, project.labels[key] ?? null])),
      billing:
        billing.billingEnabled &&
        billing.billingAccountName === `billingAccounts/${context.config.billingAccountId}`,
    };
  },
  async apply({ context, connection, resource, spec }) {
    if (spec.adopt) {
      if (!(await context.control.resourceManager.getProject(resource.account))) {
        throw new ValidationError(
          `Project ${resource.account} does not exist. Run deploy/gcp/bootstrap.sh, which creates it, or connect again naming the control project it printed`,
        );
      }
      await ensureBilling(context, resource.account);
      return;
    }
    const folder = folderOf(context, connection);
    if (!folder) {
      throw new ValidationError(`Create the ${context.config.folderName} folder first`);
    }
    const parent = spec.folder ? await ensureFolder(context, folder, spec.folder) : folder;
    await ensureProject(context, {
      projectId: resource.account,
      name: spec.displayName,
      parent,
      labels: spec.labels,
    });
  },
};

export const serviceApiKind: ZoneKind<'service_api'> = {
  expected: (spec) => ({ features: [...spec.features].sort() }),
  async read({ context, resource, spec }) {
    const enabled = new Set(await context.control.serviceUsage.listEnabled(resource.account));
    return {
      features: spec.features
        .filter((feature) => FEATURE_APIS[feature].every((api) => enabled.has(api)))
        .sort(),
    };
  },
  async apply({ context, resource, spec }) {
    const enabled = new Set(await context.control.serviceUsage.listEnabled(resource.account));
    const missing = [...new Set(spec.features.flatMap((feature) => FEATURE_APIS[feature]))].filter(
      (api) => !enabled.has(api),
    );
    if (missing.length > 0) await context.control.serviceUsage.enable(resource.account, missing);
  },
};

export const networkKind: ZoneKind<'network'> = {
  expected: (spec) => ({ name: spec.name, subnets: spec.subnets }),
  async read({ context, resource, spec }) {
    const network = await context.control.compute.getNetwork(resource.account, spec.name);
    if (!network) return null;
    return { name: network.name, subnets: network.autoCreateSubnetworks ? 'auto' : 'custom' };
  },
  async apply(call) {
    const observed = await networkKind.read(call);
    if (!observed) {
      const { context, resource, spec } = call;
      await context.control.compute.createNetwork(
        resource.account,
        spec.name,
        spec.subnets === 'auto',
      );
    } else if (observed['subnets'] !== call.spec.subnets) {
      // Google cannot switch a network's subnet mode in place, and replacing a network would
      // cut off whatever already uses it, so a person decides.
      throw new ValidationError(
        `Network ${call.spec.name} in ${call.resource.account} uses ${String(observed['subnets'])} subnets; change it by hand or rename it in the layout`,
      );
    }
  },
};

export const loggingKind: ZoneKind<'logging'> = {
  expected: (spec) => ({ retentionDays: spec.retentionDays }),
  async read({ context, resource }) {
    const days = await context.control.logging.retentionDays(resource.account);
    return days === null ? null : { retentionDays: days };
  },
  async apply({ context, resource, spec }) {
    await context.control.logging.setRetentionDays(resource.account, spec.retentionDays);
  },
};

const budgetName = (projectId: string) => `Bemmoly ${projectId}`;

export const budgetKind: ZoneKind<'budget'> = {
  expected: (spec) => ({
    monthly: Math.round(spec.monthly),
    currency: spec.currency,
    alerts: [...spec.alerts].sort(),
  }),
  async read({ context, resource }) {
    const budget = await context.control.budgets.findByName(
      context.config.billingAccountId,
      budgetName(resource.account),
    );
    if (!budget) return null;
    return {
      monthly: budget.amount,
      currency: budget.currency,
      alerts: [...budget.thresholds].sort(),
    };
  },
  async apply({ context, resource, spec }) {
    const { budgets } = context.control;
    const input = {
      displayName: budgetName(resource.account),
      projectNumber: await projectNumberOf(context, resource.account),
      amount: spec.monthly,
      currency: spec.currency,
      thresholds: spec.alerts,
    };
    const existing = await budgets.findByName(context.config.billingAccountId, input.displayName);
    if (existing) await budgets.update(existing.name, input);
    else await budgets.create(context.config.billingAccountId, input);
  },
};
