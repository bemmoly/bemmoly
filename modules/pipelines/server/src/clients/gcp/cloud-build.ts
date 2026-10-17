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
  logUrl: z.string().optional(),
  results: z
    .object({
      images: z.array(z.object({ name: z.string(), digest: z.string() })).default([]),
    })
    .optional(),
});

export type CloudBuild = z.infer<typeof buildSchema>;

export interface BuildRequest {
  steps: Array<{ name: string; args: string[]; env?: string[] }>;
  images?: string[];
  serviceAccount?: string;
  timeout?: string;
  tags?: string[];
}

export function createCloudBuildClient(http: GcpHttp) {
  return {
    /** Starts a build and answers its id. */
    async createBuild(projectId: string, region: string, build: BuildRequest): Promise<string> {
      const operation = await http.send({
        method: 'POST',
        url: `${BASE}/projects/${projectId}/locations/${region}/builds`,
        body: { ...build, options: { logging: 'CLOUD_LOGGING_ONLY' } },
        schema: operationSchema,
      });
      const started = z
        .object({ build: z.object({ id: z.string() }) })
        .parse(operation.metadata ?? {});
      return started.build.id;
    },

    getBuild(projectId: string, region: string, id: string): Promise<CloudBuild> {
      return http.send({
        url: `${BASE}/projects/${projectId}/locations/${region}/builds/${id}`,
        schema: buildSchema,
      });
    },
  };
}

export type CloudBuildClient = ReturnType<typeof createCloudBuildClient>;
