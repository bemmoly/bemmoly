import { z } from 'zod';
import type { GcpHttp } from './http.ts';
import { operationSchema, waitForOperation, type PollOptions } from './operations.ts';
import { policySchema, type IamPolicy } from './policy.ts';

/* Artifact Registry v1: Docker repositories, images by digest and who may pull. */

const BASE = 'https://artifactregistry.googleapis.com/v1';

const repositorySchema = z.object({
  name: z.string(),
  format: z.string().optional(),
  description: z.string().optional(),
});

/** "projects/acme-ci/locations/asia-south1/repositories/apps". */
export const repositoryName = (projectId: string, region: string, repository: string) =>
  `projects/${projectId}/locations/${region}/repositories/${repository}`;

/** "asia-south1-docker.pkg.dev/acme-ci/apps": what docker push and pull name. */
export const dockerHostPath = (projectId: string, region: string, repository: string) =>
  `${region}-docker.pkg.dev/${projectId}/${repository}`;

/** The repository and image a Docker path names, or null when it is not Artifact Registry. */
export function parseDockerPath(path: string): { repository: string; image: string } | null {
  const match =
    /^([a-z0-9-]+)-docker\.pkg\.dev\/([a-z][a-z0-9-]+)\/([a-z0-9._-]+)(?:\/(.+))?$/.exec(path);
  if (!match) return null;
  const [, region, project, repository, image] = match;
  if (!region || !project || !repository) return null;
  return { repository: repositoryName(project, region, repository), image: image ?? '' };
}

export function createArtifactRegistryClient(http: GcpHttp, poll: PollOptions) {
  return {
    getRepository(name: string) {
      return http.find({ url: `${BASE}/${name}`, schema: repositorySchema });
    },

    async createRepository(projectId: string, region: string, repositoryId: string) {
      const operation = await http.send({
        method: 'POST',
        url: `${BASE}/projects/${projectId}/locations/${region}/repositories`,
        query: { repositoryId },
        body: { format: 'DOCKER', description: 'Release images built or registered by Bemmoly' },
        schema: operationSchema,
      });
      return repositorySchema.parse(await waitForOperation(http, BASE, operation, poll));
    },

    /** Whether `image@digest` is in the repository; images may have slashes in their path. */
    async hasImage(repository: string, image: string, digest: string): Promise<boolean> {
      const found = await http.find({
        url: `${BASE}/${repository}/dockerImages/${encodeURIComponent(`${image}@${digest}`)}`,
        schema: z.object({ name: z.string(), uri: z.string().optional() }),
      });
      return found !== null;
    },

    getPolicy(repository: string): Promise<IamPolicy> {
      return http.send({ url: `${BASE}/${repository}:getIamPolicy`, schema: policySchema });
    },

    async setPolicy(repository: string, policy: IamPolicy): Promise<void> {
      await http.send({
        method: 'POST',
        url: `${BASE}/${repository}:setIamPolicy`,
        body: { policy },
        schema: policySchema,
      });
    },
  };
}

export type ArtifactRegistryClient = ReturnType<typeof createArtifactRegistryClient>;
