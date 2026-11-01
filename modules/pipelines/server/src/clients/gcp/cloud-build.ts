import { z } from 'zod';
import type { GcpHttp } from './http.ts';
import { operationSchema } from './operations.ts';

/*
 * Cloud Build v1: the no-cluster build executor. A build is created and then followed by
 * id; its operation is not awaited here, because a build runs for minutes and its progress
 * is read with getBuild by whoever is watching it.
 */

const BASE = 'https://cloudbuild.googleapis.com/v1';

const buildSchema = z.object({
  id: z.string(),
  status: z.string(),
  statusDetail: z.string().optional(),
  logUrl: z.string().optional(),
  failureInfo: z.object({ type: z.string().optional(), detail: z.string().optional() }).optional(),
  results: z
    .object({
      images: z.array(z.object({ name: z.string(), digest: z.string() })).default([]),
    })
    .optional(),
});

export type CloudBuild = z.infer<typeof buildSchema>;

export interface BuildRequest {
  steps: Array<{ name: string; args?: string[]; env?: string[] }>;
  images?: string[];
  /** `projects/<project>/serviceAccounts/<email>`. */
  serviceAccount?: string;
  timeout?: string;
  tags?: string[];
  /** User substitutions, `_NAME` keys; steps read them as `$_NAME` in their env. */
  substitutions?: Record<string, string>;
  /** "E2_HIGHCPU_8"; left out for Cloud Build's default. */
  machineType?: string;
}

const buildsUrl = (projectId: string, region: string) =>
  `${BASE}/projects/${projectId}/locations/${region}/builds`;

export function createCloudBuildClient(http: GcpHttp) {
  return {
    /** Starts a build and answers its id and log address. */
    async createBuild(
      projectId: string,
      region: string,
      build: BuildRequest,
    ): Promise<{ id: string; logUrl: string | null }> {
      const { machineType, ...rest } = build;
      const operation = await http.send({
        method: 'POST',
        url: buildsUrl(projectId, region),
        body: {
          ...rest,
          // A build that names its own service account must send logs to Cloud Logging only.
          options: { logging: 'CLOUD_LOGGING_ONLY', ...(machineType ? { machineType } : {}) },
        },
        schema: operationSchema,
      });
      const started = z
        .object({ build: z.object({ id: z.string(), logUrl: z.string().optional() }) })
        .parse(operation.metadata ?? {});
      return { id: started.build.id, logUrl: started.build.logUrl ?? null };
    },

    /** The build, or null when Cloud Build no longer has it. */
    findBuild(projectId: string, region: string, id: string): Promise<CloudBuild | null> {
      return http.find({ url: `${buildsUrl(projectId, region)}/${id}`, schema: buildSchema });
    },

    getBuild(projectId: string, region: string, id: string): Promise<CloudBuild> {
      return http.send({ url: `${buildsUrl(projectId, region)}/${id}`, schema: buildSchema });
    },

    /** Cancels a queued or working build; Cloud Build answers the build as it now is. */
    cancelBuild(projectId: string, region: string, id: string): Promise<CloudBuild> {
      return http.send({
        method: 'POST',
        url: `${buildsUrl(projectId, region)}/${id}:cancel`,
        body: { projectId, id },
        schema: buildSchema,
      });
    },
  };
}

export type CloudBuildClient = ReturnType<typeof createCloudBuildClient>;
