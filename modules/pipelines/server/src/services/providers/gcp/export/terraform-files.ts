import type { ExportFile } from '../../export-contract.ts';
import {
  attr,
  blank,
  block,
  comment,
  nameOf,
  object,
  render,
  spaced,
  str,
  type Item,
  type Value,
} from './hcl.ts';
import type { Terraform, TerraformFile } from './terraform-context.ts';
import { pipelinesMember } from './terraform-identity.ts';

/*
 * The files around the resources: the pinned provider, the variables that differ per company
 * with this company's values in terraform.tfvars, the import blocks that adopt what exists,
 * the build pools (which leave nothing behind to import) and the front door's place.
 */

/** Google's provider, held to one major version; terraform init's lock file pins the build. */
export const GOOGLE_PROVIDER = '~> 8.0';

const RESOURCE_FILES: readonly TerraformFile[] = [
  'landing-zone.tf',
  'identities.tf',
  'registry.tf',
  'secrets.tf',
  'cloud-run.tf',
  'clusters.tf',
];

const HEADERS: Readonly<Record<TerraformFile, string>> = {
  'landing-zone.tf':
    'The folders, projects, APIs, networks, log retention and budgets Pipelines made.',
  'identities.tf': 'Service accounts and the roles Pipelines granted them.',
  'registry.tf': 'The shared image registry and who may pull from and push to it.',
  'secrets.tf':
    'Secret Manager secrets and who may read them. Values are never exported; they stay in\nSecret Manager, where Pipelines wrote them.',
  'cloud-run.tf':
    'The Cloud Run service of each application in each environment, at its serving release.\nRevision history and canary weights are left out; traffic is ignored, so set it here\nwhen you take over releasing.',
  'clusters.tf': 'GKE clusters Pipelines created. What runs in them is in the Helm charts.',
};

function versions(): Item[] {
  return [
    block(
      'terraform',
      [],
      [
        attr('required_version', str('>= 1.7')),
        blank,
        block(
          'required_providers',
          [],
          [
            attr(
              'google',
              object({ source: str('hashicorp/google'), version: str(GOOGLE_PROVIDER) }),
            ),
          ],
        ),
      ],
    ),
    blank,
    block('provider', ['google'], [attr('region', 'var.region')]),
  ];
}

function variable(name: string, description: string, type: string): Item[] {
  return [block('variable', [name], [attr('description', str(description)), attr('type', type)])];
}

/** Each variable a resource used, with this company's value for terraform.tfvars. */
function variables(tf: Terraform): { declared: Item[]; values: Item[] } {
  const config = tf.records.connection.config;
  const managed = (config['mode'] ?? 'managed') === 'managed';
  const used = (name: string) =>
    [...tf.files.values(), tf.imports]
      .flat(2)
      .some((item) => JSON.stringify(item).includes(`var.${name}`));
  const map = (accounts: Set<string>, value: (account: string) => string | null) =>
    object(
      Object.fromEntries(
        [...accounts].map((account) => [nameOf(account), str(value(account) ?? '')]),
      ),
    );
  const folderId = (tf.records.connection.boundaryRef ?? '').replace(/^folders\//, '');
  const wanted: Array<[string, string, string, Value]> = [];
  const add = (name: string, description: string, type: string, value: Value) =>
    wanted.push([name, description, type, value]);
  add(
    'region',
    'Where services go when an environment names no region.',
    'string',
    str(String(config['region'] ?? 'us-central1')),
  );
  if (managed && used('folder_id'))
    add('folder_id', 'The folder bootstrap.sh made, as digits.', 'string', str(folderId));
  if (managed && used('billing_account')) {
    add(
      'billing_account',
      'The billing account that pays for the projects.',
      'string',
      str(String(config['billingAccountId'] ?? '')),
    );
  }
  if (tf.folders.size > 0) {
    add(
      'folders',
      "Each domain folder's ID, as digits.",
      'map(string)',
      object(Object.fromEntries([...tf.folders].map(([name, id]) => [name, str(id ?? '')]))),
    );
  }
  add(
    'projects',
    'Project IDs, by the name the resources use.',
    'map(string)',
    map(tf.projects, (account) => account),
  );
  if (tf.numbers.size > 0) {
    add(
      'project_numbers',
      'Project numbers, which Google names service agents and pools by.',
      'map(string)',
      map(tf.numbers, (account) => tf.facts.accounts[account]?.number ?? null),
    );
  }
  if (tf.records.connection.principal && used('pipelines_member')) {
    add(
      'pipelines_member',
      'Who Pipelines signs in as, so it may deploy as each deployer.',
      'string',
      str(pipelinesMember(tf.records.connection.principal)),
    );
  }
  return {
    declared: spaced(wanted.map(([name, description, type]) => variable(name, description, type))),
    values: wanted.map(([name, , , value]) => attr(name, value)),
  };
}

function buildPools(tf: Terraform): Item[] {
  const pools = Object.fromEntries(
    tf.records.pools.map((pool) => [
      nameOf(pool.key),
      object({
        project: str(pool.account),
        region: str(pool.region),
        image: str(pool.image),
        machine: str(pool.machine),
        service_account: str(pool.serviceAccount),
      }),
    ]),
  );
  return [
    comment(
      'Cloud Build pools start one build per job, running the runner image for that job, and\nleave nothing behind to import. These are the settings each pool starts builds with.',
    ),
    block('locals', [], [attr('cloud_build_pools', object(pools))]),
  ];
}

const FRONT_DOOR = comment(
  'The front door: one load balancer per service, so a move between Cloud Run and GKE is a\nweighted traffic change. Pipelines does not make one yet. When it does, its addresses,\nbackends and certificates are exported in this file.',
);

export function terraformFiles(tf: Terraform): ExportFile[] {
  const files: ExportFile[] = [{ path: 'terraform/versions.tf', content: render(versions()) }];
  const { declared, values } = variables(tf);
  for (const file of RESOURCE_FILES) {
    const groups = tf.files.get(file);
    if (!groups) continue;
    files.push({
      path: `terraform/${file}`,
      content: render([comment(HEADERS[file]), blank, ...spaced(groups)]),
    });
  }
  if (tf.records.pools.length > 0)
    files.push({ path: 'terraform/build-pools.tf', content: render(buildPools(tf)) });
  files.push({ path: 'terraform/front-door.tf', content: render([FRONT_DOOR]) });
  if (tf.imports.length > 0) {
    files.push({
      path: 'terraform/imports.tf',
      content: render([
        comment(
          'Adopts what exists instead of creating it again. After the first apply these blocks do\nnothing, and you may delete them.',
        ),
        blank,
        ...spaced(tf.imports),
      ]),
    });
  }
  files.push({ path: 'terraform/variables.tf', content: render(declared) });
  files.push({ path: 'terraform/terraform.tfvars', content: render(values) });
  return files;
}
