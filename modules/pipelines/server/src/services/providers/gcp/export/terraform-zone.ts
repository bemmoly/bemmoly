import type { ExportResource } from '../../export-contract.ts';
import { SPEC_SCHEMAS } from '../../specs.ts';
import { MANAGED_LABEL } from '../org.ts';
import { FEATURE_APIS } from '../zone-kind.ts';
import { attr, block, bool, interpolate, list, num, object, str, type Item } from './hcl.ts';
import type { Terraform } from './terraform-context.ts';

/*
 * The landing zone itself: the domain folders, the projects Pipelines made, the APIs on each,
 * networks, log retention and budgets. A project the bootstrap made (the control project) is
 * only referred to; Pipelines never managed it, so the export does not either.
 */

/** Labels as Pipelines writes them: the spec's, plus the one saying Bemmoly made it. */
export const managedLabels = (labels: Readonly<Record<string, string>> = {}) =>
  object(
    Object.fromEntries(
      Object.entries({ ...labels, ...MANAGED_LABEL }).map(([k, v]) => [k, str(v)]),
    ),
  );

/** Each domain folder once, named by what a project's parent says it is. */
function folders(tf: Terraform, accounts: readonly ExportResource[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const resource of accounts) {
    const spec = SPEC_SCHEMAS.account.parse(resource.spec);
    if (!spec.folder || names.has(spec.folder)) continue;
    const name = tf.unique('google_folder', spec.folder);
    names.set(spec.folder, name);
    const parent = tf.facts.accounts[resource.account]?.parent ?? null;
    tf.add('landing-zone.tf', {
      type: 'google_folder',
      name,
      note: `The ${spec.folder} domain's folder.`,
      body: [
        attr('display_name', str(spec.folder)),
        attr('parent', interpolate(['folders/', { ref: 'var.folder_id' }])),
      ],
      importId: interpolate(['folders/', { ref: `var.folders.${name}` }]),
    });
    tf.folders.set(name, parent?.startsWith('folders/') ? parent.slice('folders/'.length) : null);
  }
  return names;
}

function project(tf: Terraform, resource: ExportResource, folder: string | null) {
  const spec = SPEC_SCHEMAS.account.parse(resource.spec);
  tf.add('landing-zone.tf', {
    type: 'google_project',
    name: tf.unique('google_project', resource.account),
    body: [
      attr('project_id', tf.projectVar(resource.account)),
      attr('name', str(spec.displayName.slice(0, 30))),
      attr('folder_id', folder ? `google_folder.${folder}.folder_id` : 'var.folder_id'),
      attr('billing_account', 'var.billing_account'),
      attr('labels', managedLabels(spec.labels)),
    ],
    importId: interpolate([{ ref: tf.projectVar(resource.account) }]),
  });
}

function services(tf: Terraform, resource: ExportResource) {
  const spec = SPEC_SCHEMAS.service_api.parse(resource.spec);
  const apis = [...new Set(spec.features.flatMap((feature) => FEATURE_APIS[feature]))].sort();
  for (const api of apis) {
    tf.add('landing-zone.tf', {
      type: 'google_project_service',
      name: tf.unique('google_project_service', `${resource.account}_${api.split('.')[0] ?? api}`),
      body: [attr('project', tf.projectRef(resource.account)), attr('service', str(api))],
      importId: tf.inProject(resource.account, '', `/${api}`),
    });
  }
}

function network(tf: Terraform, resource: ExportResource) {
  const spec = SPEC_SCHEMAS.network.parse(resource.spec);
  tf.add('landing-zone.tf', {
    type: 'google_compute_network',
    name: tf.unique('google_compute_network', `${resource.account}_${spec.name}`),
    body: [
      attr('project', tf.projectRef(resource.account)),
      attr('name', str(spec.name)),
      attr('auto_create_subnetworks', bool(spec.subnets === 'auto')),
    ],
    importId: tf.inProject(resource.account, 'projects/', `/global/networks/${spec.name}`),
  });
}

function logging(tf: Terraform, resource: ExportResource) {
  const spec = SPEC_SCHEMAS.logging.parse(resource.spec);
  tf.add('landing-zone.tf', {
    type: 'google_logging_project_bucket_config',
    name: tf.unique('google_logging_project_bucket_config', `${resource.account}_default`),
    note: 'How long the project keeps its logs; the _Default bucket always exists.',
    body: [
      attr('project', tf.projectRef(resource.account)),
      attr('location', str('global')),
      attr('bucket_id', str('_Default')),
      attr('retention_days', num(spec.retentionDays)),
    ],
    importId: tf.inProject(resource.account, 'projects/', '/locations/global/buckets/_Default'),
  });
}

function budget(tf: Terraform, resource: ExportResource) {
  const spec = SPEC_SCHEMAS.budget.parse(resource.spec);
  const known = tf.facts.budgets[resource.account];
  if (!known) {
    tf.fill.push(
      `The budget for ${resource.account} is declared without an import: find its name with gcloud billing budgets list --billing-account=BILLING_ACCOUNT and add one, or terraform plan will create a second budget`,
    );
  }
  const thresholds: Item[] = [...spec.alerts]
    .sort((a, b) => a - b)
    .map((alert) => block('threshold_rules', [], [attr('threshold_percent', num(alert))]));
  tf.add('landing-zone.tf', {
    type: 'google_billing_budget',
    name: tf.unique('google_billing_budget', resource.account),
    body: [
      attr('billing_account', 'var.billing_account'),
      attr('display_name', str(`Bemmoly ${resource.account}`)),
      block(
        'budget_filter',
        [],
        [
          attr(
            'projects',
            list([interpolate(['projects/', { ref: tf.numberVar(resource.account) }])]),
          ),
        ],
      ),
      block(
        'amount',
        [],
        [
          block(
            'specified_amount',
            [],
            [
              attr('currency_code', str(spec.currency)),
              attr('units', str(String(Math.round(spec.monthly)))),
            ],
          ),
        ],
      ),
      ...thresholds,
    ],
    ...(known ? { importId: str(known) } : {}),
  });
}

/** Every landing zone resource of these kinds, in the order a person reads them. */
export function landingZone(tf: Terraform): void {
  const of = (kind: ExportResource['kind']) => tf.records.resources.filter((r) => r.kind === kind);
  const made = of('account').filter((resource) => resource.spec['adopt'] !== true);
  const folderNames = folders(tf, made);
  for (const resource of made) {
    const folder = SPEC_SCHEMAS.account.parse(resource.spec).folder;
    project(tf, resource, folder ? (folderNames.get(folder) ?? null) : null);
  }
  for (const resource of of('service_api')) services(tf, resource);
  for (const resource of of('network')) network(tf, resource);
  for (const resource of of('logging')) logging(tf, resource);
  for (const resource of of('budget')) budget(tf, resource);
}
