import { z } from 'zod';
import type { GcpHttp } from './http.ts';
import { policySchema, type IamPolicy } from './policy.ts';

/*
 * Secret Manager v1, write side only: create a secret, add a version, grant access. There is
 * deliberately no call that reads a version's payload; Pipelines never sees a value again
 * once it has been written through.
 */

const BASE = 'https://secretmanager.googleapis.com/v1';

const secretSchema = z.object({ name: z.string() });

export const secretName = (projectId: string, secret: string) =>
  `projects/${projectId}/secrets/${secret}`;

export function createSecretManagerClient(http: GcpHttp) {
  return {
    getSecret(projectId: string, secret: string) {
      return http.find({ url: `${BASE}/${secretName(projectId, secret)}`, schema: secretSchema });
    },

    createSecret(projectId: string, secret: string, labels: Readonly<Record<string, string>>) {
      return http.send({
        method: 'POST',
        url: `${BASE}/projects/${projectId}/secrets`,
        query: { secretId: secret },
        body: { replication: { automatic: {} }, labels },
        schema: secretSchema,
      });
    },

    /** Adds a version and answers its number ("3"); the value goes no further than this. */
    async addVersion(projectId: string, secret: string, value: string): Promise<string> {
      const answer = await http.send({
        method: 'POST',
        url: `${BASE}/${secretName(projectId, secret)}:addVersion`,
        body: { payload: { data: Buffer.from(value, 'utf8').toString('base64') } },
        schema: z.object({ name: z.string(), state: z.string().optional() }),
      });
      return answer.name.split('/').pop() ?? answer.name;
    },

    getPolicy(projectId: string, secret: string): Promise<IamPolicy> {
      return http.send({
        url: `${BASE}/${secretName(projectId, secret)}:getIamPolicy`,
        schema: policySchema,
      });
    },

    async setPolicy(projectId: string, secret: string, policy: IamPolicy): Promise<void> {
      await http.send({
        method: 'POST',
        url: `${BASE}/${secretName(projectId, secret)}:setIamPolicy`,
        body: { policy },
        schema: policySchema,
      });
    },
  };
}

export type SecretManagerClient = ReturnType<typeof createSecretManagerClient>;
