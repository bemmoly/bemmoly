import { principalMember, serviceAccountEmail } from '../../../../clients/gcp/index.ts';
import type { ExportResource } from '../../export-contract.ts';
import { SPEC_SCHEMAS } from '../../specs.ts';
import {
  DEPLOYER_ROLES,
  IDENTITY_ROLES,
  REGISTRY_ROLES,
  SECRET_ACCESSOR,
  TOKEN_CREATOR,
} from '../zone-kind.ts';
import { attr, interpolate, str, type Expr } from './hcl.ts';
import type { Terraform } from './terraform-context.ts';

/*
 * Who acts where: the deployer and runtime service accounts and their project roles, the
 * control identity's right to act as each deployer, the shared registry and who may pull from
 * or push to it, and who may read each project's secrets. Members are written out in full in
 * import IDs, since an import cannot read another resource.
 */

const DESCRIPTION = 'Managed by Bemmoly Pipelines; changes are reverted by the landing zone';

/** "serviceAccount:runtime@${var.projects.x}.iam.gserviceaccount.com" inside a string. */
function memberText(tf: Terraform, name: string, account: string) {
  return [`serviceAccount:${name}@`, { ref: tf.projectVar(account) }, '.iam.gserviceaccount.com'];
}

/** A service account's email: its resource when declared here, else written out. */
export function emailOf(tf: Terraform, name: string, account: string): Expr {
  const declared = tf.identities.get(`${name}@${account}`);
  return declared
    ? `google_service_account.${declared}.email`
    : str(serviceAccountEmail(name, account));
}

function serviceAccount(tf: Terraform, account: string, name: string): string {
  const tfName = tf.unique('google_service_account', `${account}_${name}`);
  tf.identities.set(`${name}@${account}`, tfName);
  tf.add('identities.tf', {
    type: 'google_service_account',
    name: tfName,
    body: [
      attr('project', tf.projectRef(account)),
      attr('account_id', str(name)),
      attr('display_name', str(`Bemmoly ${name}`)),
      attr('description', str(DESCRIPTION)),
    ],
    importId: interpolate([
      'projects/',
      { ref: tf.projectVar(account) },
      `/serviceAccounts/${name}@`,
      { ref: tf.projectVar(account) },
      '.iam.gserviceaccount.com',
    ]),
  });
  return tfName;
}

function projectRoles(tf: Terraform, account: string, identity: string, roles: readonly string[]) {
  const tfName = tf.identities.get(`${identity}@${account}`) ?? identity;
  for (const role of roles) {
    tf.add('identities.tf', {
      type: 'google_project_iam_member',
      name: tf.unique('google_project_iam_member', `${tfName}_${role.split('/').pop() ?? role}`),
      body: [
        attr('project', tf.projectRef(account)),
        attr('role', str(role)),
        attr('member', `google_service_account.${tfName}.member`),
      ],
      importId: interpolate([
        { ref: tf.projectVar(account) },
        ` ${role} `,
        ...memberText(tf, identity, account),
      ]),
    });
  }
}

function deployer(tf: Terraform, resource: ExportResource) {
  const spec = SPEC_SCHEMAS.deployer_identity.parse(resource.spec);
  const tfName = serviceAccount(tf, resource.account, spec.name);
  projectRoles(tf, resource.account, spec.name, DEPLOYER_ROLES);
  if (!tf.records.connection.principal) return;
  tf.add('identities.tf', {
    type: 'google_service_account_iam_member',
    name: tf.unique('google_service_account_iam_member', `${tfName}_pipelines`),
    note: 'Lets Pipelines deploy as this account. Remove it once Pipelines no longer deploys here.',
    body: [
      attr('service_account_id', `google_service_account.${tfName}.name`),
      attr('role', str(TOKEN_CREATOR)),
      attr('member', 'var.pipelines_member'),
    ],
    importId: interpolate([
      'projects/',
      { ref: tf.projectVar(resource.account) },
      `/serviceAccounts/${spec.name}@`,
      { ref: tf.projectVar(resource.account) },
      `.iam.gserviceaccount.com ${TOKEN_CREATOR} `,
      { ref: 'var.pipelines_member' },
    ]),
  });
}

function runtime(tf: Terraform, resource: ExportResource) {
  const spec = SPEC_SCHEMAS.runtime_identity.parse(resource.spec);
  serviceAccount(tf, resource.account, spec.name);
  projectRoles(tf, resource.account, spec.name, IDENTITY_ROLES[spec.purpose]);
}

/** The shared repository once, then each account's pull or push grant on it. */
function registry(tf: Terraform, resource: ExportResource, repositories: Map<string, string>) {
  const spec = SPEC_SCHEMAS.registry_access.parse(resource.spec);
  const key = `${spec.registryAccount}/${spec.region}/${spec.repository}`;
  let repo = repositories.get(key);
  if (!repo) {
    repo = tf.unique('google_artifact_registry_repository', spec.repository);
    repositories.set(key, repo);
    tf.add('registry.tf', {
      type: 'google_artifact_registry_repository',
      name: repo,
      note: 'The one registry every image is pushed to once and deployed from by digest.',
      body: [
        attr('project', tf.projectRef(spec.registryAccount)),
        attr('location', str(spec.region)),
        attr('repository_id', str(spec.repository)),
        attr('format', str('DOCKER')),
        attr('description', str('Release images built or registered by Bemmoly')),
      ],
      importId: tf.inProject(
        spec.registryAccount,
        'projects/',
        `/locations/${spec.region}/repositories/${spec.repository}`,
      ),
    });
  }
  const role = REGISTRY_ROLES[spec.access];
  // Cloud Run pulls as the project's service agent, other runtimes as the identity itself.
  const identity = tf.identities.get(`${spec.identity}@${resource.account}`);
  const parts = memberText(tf, spec.identity, resource.account);
  const members: Array<{ label: string; parts: Array<string | { ref: string }>; expr: Expr }> = [
    {
      label: spec.identity,
      parts,
      expr: identity ? `google_service_account.${identity}.member` : interpolate(parts),
    },
  ];
  if (spec.access === 'pull') {
    const agent = [
      'serviceAccount:service-',
      { ref: tf.numberVar(resource.account) },
      '@serverless-robot-prod.iam.gserviceaccount.com',
    ];
    members.unshift({ label: 'run_agent', parts: agent, expr: interpolate(agent) });
  }
  for (const member of members) {
    tf.add('registry.tf', {
      type: 'google_artifact_registry_repository_iam_member',
      name: tf.unique(
        'google_artifact_registry_repository_iam_member',
        `${resource.account}_${member.label}_${spec.access}`,
      ),
      body: [
        attr('project', `google_artifact_registry_repository.${repo}.project`),
        attr('location', `google_artifact_registry_repository.${repo}.location`),
        attr('repository', `google_artifact_registry_repository.${repo}.name`),
        attr('role', str(role)),
        attr('member', member.expr),
      ],
      importId: interpolate([
        'projects/',
        { ref: tf.projectVar(spec.registryAccount) },
        `/locations/${spec.region}/repositories/${spec.repository} ${role} `,
        ...member.parts,
      ]),
    });
  }
}

function secretReaders(tf: Terraform, resource: ExportResource) {
  const spec = SPEC_SCHEMAS.secret_store.parse(resource.spec);
  for (const reader of [...spec.readers].sort()) {
    tf.add('identities.tf', {
      type: 'google_project_iam_member',
      name: tf.unique('google_project_iam_member', `${resource.account}_${reader}_secrets`),
      body: [
        attr('project', tf.projectRef(resource.account)),
        attr('role', str(SECRET_ACCESSOR)),
        attr('member', interpolate(memberText(tf, reader, resource.account))),
      ],
      importId: interpolate([
        { ref: tf.projectVar(resource.account) },
        ` ${SECRET_ACCESSOR} `,
        ...memberText(tf, reader, resource.account),
      ]),
    });
  }
}

export function identities(tf: Terraform): void {
  const of = (kind: ExportResource['kind']) => tf.records.resources.filter((r) => r.kind === kind);
  for (const resource of of('deployer_identity')) deployer(tf, resource);
  for (const resource of of('runtime_identity')) runtime(tf, resource);
  const repositories = new Map<string, string>();
  for (const resource of of('registry_access')) registry(tf, resource, repositories);
  for (const resource of of('secret_store')) secretReaders(tf, resource);
}

/** The variable's value: "serviceAccount:…" or "user:…" for whoever Pipelines signs in as. */
export const pipelinesMember = (principal: string) => principalMember(principal);
