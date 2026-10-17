import {
  dockerHostPath,
  hasBinding,
  repositoryName,
  serviceAccountEmail,
  serviceAccountMember,
  withBinding,
  type IamPolicy,
} from '../../../clients/gcp/index.ts';
import type { GcpContext } from './context.ts';
import {
  DEPLOYER_ROLES,
  IDENTITY_ROLES,
  REGISTRY_ROLES,
  SECRET_ACCESSOR,
  TOKEN_CREATOR,
  projectNumberOf,
  runServiceAgent,
  type ZoneKind,
} from './zone-kind.ts';

/* Service accounts, their project roles, registry access and who may read secrets. */

/** Adds every (role, member) pair the policy lacks; null when nothing changes. */
function withBindings(policy: IamPolicy, pairs: ReadonlyArray<[string, string]>): IamPolicy | null {
  let next = policy;
  let changed = false;
  for (const [role, member] of pairs) {
    const updated = withBinding(next, role, member);
    if (updated) {
      next = updated;
      changed = true;
    }
  }
  return changed ? next : null;
}

async function grantOnProject(
  context: GcpContext,
  projectId: string,
  pairs: ReadonlyArray<[string, string]>,
): Promise<void> {
  const rm = context.control.resourceManager;
  const updated = withBindings(await rm.getProjectPolicy(projectId), pairs);
  if (updated) await rm.setProjectPolicy(projectId, updated);
}

const rolesHeld = (policy: IamPolicy, member: string, roles: readonly string[]) =>
  roles.filter((role) => hasBinding(policy, role, member)).sort();

async function ensureServiceAccount(context: GcpContext, projectId: string, name: string) {
  const email = serviceAccountEmail(name, projectId);
  const found = await context.control.iam.getServiceAccount(projectId, email);
  if (!found) {
    await context.control.iam.createServiceAccount(projectId, {
      accountId: name,
      displayName: `Bemmoly ${name}`,
      description: 'Managed by Bemmoly Pipelines; changes are reverted by the landing zone',
    });
  }
  return email;
}

export const deployerKind: ZoneKind<'deployer_identity'> = {
  expected: (spec) => ({ name: spec.name, roles: [...DEPLOYER_ROLES].sort(), impersonated: true }),
  async read({ context, resource, spec }) {
    const email = serviceAccountEmail(spec.name, resource.account);
    if (!(await context.control.iam.getServiceAccount(resource.account, email))) return null;
    const policy = await context.control.resourceManager.getProjectPolicy(resource.account);
    const control = await context.principal();
    // A pool principal with no service account behind it cannot be named in a policy, so
    // the grant is left to whoever set up the pool.
    const impersonated = control
      ? hasBinding(
          await context.control.iam.getServiceAccountPolicy(email),
          TOKEN_CREATOR,
          serviceAccountMember(control),
        )
      : true;
    return {
      name: spec.name,
      roles: rolesHeld(policy, serviceAccountMember(email), DEPLOYER_ROLES),
      impersonated,
    };
  },
  async apply({ context, resource, spec }) {
    const email = await ensureServiceAccount(context, resource.account, spec.name);
    const member = serviceAccountMember(email);
    await grantOnProject(
      context,
      resource.account,
      DEPLOYER_ROLES.map((role) => [role, member]),
    );
    const control = await context.principal();
    if (!control) return;
    const policy = await context.control.iam.getServiceAccountPolicy(email);
    const updated = withBinding(policy, TOKEN_CREATOR, serviceAccountMember(control));
    if (updated) await context.control.iam.setServiceAccountPolicy(email, updated);
  },
};

export const identityKind: ZoneKind<'runtime_identity'> = {
  expected: (spec) => ({ name: spec.name, roles: [...IDENTITY_ROLES[spec.purpose]].sort() }),
  async read({ context, resource, spec }) {
    const email = serviceAccountEmail(spec.name, resource.account);
    if (!(await context.control.iam.getServiceAccount(resource.account, email))) return null;
    const policy = await context.control.resourceManager.getProjectPolicy(resource.account);
    return {
      name: spec.name,
      roles: rolesHeld(policy, serviceAccountMember(email), IDENTITY_ROLES[spec.purpose]),
    };
  },
  async apply({ context, resource, spec }) {
    const member = serviceAccountMember(
      await ensureServiceAccount(context, resource.account, spec.name),
    );
    await grantOnProject(
      context,
      resource.account,
      IDENTITY_ROLES[spec.purpose].map((role) => [role, member]),
    );
  },
};

/** Pulls are made by the Cloud Run service agent; pushes by the named identity. */
async function registryMember(
  context: GcpContext,
  account: string,
  spec: { access: 'pull' | 'push'; identity: string },
): Promise<string> {
  if (spec.access === 'pull') return runServiceAgent(await projectNumberOf(context, account));
  return serviceAccountMember(serviceAccountEmail(spec.identity, account));
}

export const registryAccessKind: ZoneKind<'registry_access'> = {
  expected: (spec) => ({
    repository: dockerHostPath(spec.registryAccount, spec.region, spec.repository),
    access: spec.access,
    granted: true,
  }),
  async read({ context, resource, spec }) {
    const name = repositoryName(spec.registryAccount, spec.region, spec.repository);
    const ar = context.control.artifactRegistry;
    if (!(await ar.getRepository(name))) return null;
    const member = await registryMember(context, resource.account, spec);
    return {
      repository: dockerHostPath(spec.registryAccount, spec.region, spec.repository),
      access: spec.access,
      granted: hasBinding(await ar.getPolicy(name), REGISTRY_ROLES[spec.access], member),
    };
  },
  async apply({ context, resource, spec }) {
    const ar = context.control.artifactRegistry;
    const name = repositoryName(spec.registryAccount, spec.region, spec.repository);
    if (!(await ar.getRepository(name))) {
      await ar.createRepository(spec.registryAccount, spec.region, spec.repository);
    }
    const member = await registryMember(context, resource.account, spec);
    const updated = withBinding(await ar.getPolicy(name), REGISTRY_ROLES[spec.access], member);
    if (updated) await ar.setPolicy(name, updated);
  },
};

export const secretStoreKind: ZoneKind<'secret_store'> = {
  expected: (spec) => ({ readers: [...spec.readers].sort() }),
  async read({ context, resource, spec }) {
    const policy = await context.control.resourceManager.getProjectPolicy(resource.account);
    return {
      readers: spec.readers
        .filter((name) =>
          hasBinding(
            policy,
            SECRET_ACCESSOR,
            serviceAccountMember(serviceAccountEmail(name, resource.account)),
          ),
        )
        .sort(),
    };
  },
  async apply({ context, resource, spec }) {
    await grantOnProject(
      context,
      resource.account,
      spec.readers.map((name) => [
        SECRET_ACCESSOR,
        serviceAccountMember(serviceAccountEmail(name, resource.account)),
      ]),
    );
  },
};
