import { ValidationError } from '@bemmoly/shared';
import {
  dockerHostPath,
  parseDockerPath,
  repositoryName,
  serviceAccountMember,
  withBinding,
} from '../../../clients/gcp/index.ts';
import type { RegistryPart, SecretsPart } from '../contract.ts';
import type { GcpContexts } from './context.ts';
import { MANAGED_LABEL } from './org.ts';
import { REGISTRY_ROLES, SECRET_ACCESSOR } from './zone-kind.ts';

/* Artifact Registry repositories and Secret Manager secrets, as the control identity. */

/** "runtime@p.iam.gserviceaccount.com" or an IAM member as is ("group:sre@acme.com"). */
export function memberOf(principal: string): string {
  if (principal.includes(':')) return principal;
  if (principal.endsWith('.gserviceaccount.com')) return serviceAccountMember(principal);
  return `user:${principal}`;
}

function repositoryOf(path: string) {
  const parsed = parseDockerPath(path);
  if (!parsed) throw new ValidationError(`${path} is not an Artifact Registry repository`);
  return parsed;
}

export function createGcpRegistry(contexts: GcpContexts): RegistryPart {
  return {
    async ensureRepository(connection, input) {
      const ar = contexts(connection).control.artifactRegistry;
      if (!(await ar.getRepository(repositoryName(input.account, input.region, input.name)))) {
        await ar.createRepository(input.account, input.region, input.name);
      }
      return { repository: dockerHostPath(input.account, input.region, input.name) };
    },

    async grantPull(connection, input) {
      const ar = contexts(connection).control.artifactRegistry;
      const { repository } = repositoryOf(input.repository);
      const updated = withBinding(
        await ar.getPolicy(repository),
        REGISTRY_ROLES.pull,
        memberOf(input.principal),
      );
      if (updated) await ar.setPolicy(repository, updated);
    },

    async hasDigest(connection, input) {
      const { repository, image } = repositoryOf(input.repository);
      if (!image) throw new ValidationError(`${input.repository} names no image`);
      return contexts(connection).control.artifactRegistry.hasImage(
        repository,
        image,
        input.digest,
      );
    },
  };
}

export function createGcpSecrets(contexts: GcpContexts): SecretsPart {
  return {
    async writeVersion(connection, input) {
      const sm = contexts(connection).control.secretManager;
      if (!(await sm.getSecret(input.account, input.name))) {
        await sm.createSecret(input.account, input.name, MANAGED_LABEL);
      }
      return { version: await sm.addVersion(input.account, input.name, input.value) };
    },

    async grantAccess(connection, input) {
      const sm = contexts(connection).control.secretManager;
      const updated = withBinding(
        await sm.getPolicy(input.account, input.name),
        SECRET_ACCESSOR,
        memberOf(input.principal),
      );
      if (updated) await sm.setPolicy(input.account, input.name, updated);
    },
  };
}
