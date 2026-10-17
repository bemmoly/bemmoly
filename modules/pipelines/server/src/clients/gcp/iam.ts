import { z } from 'zod';
import type { GcpHttp } from './http.ts';
import { policySchema, type IamPolicy } from './policy.ts';

/* IAM v1: service accounts and the policy on each one (who may impersonate it). */

const BASE = 'https://iam.googleapis.com/v1';

const serviceAccountSchema = z.object({
  name: z.string(),
  email: z.string(),
  uniqueId: z.string().optional(),
  displayName: z.string().optional(),
  disabled: z.boolean().optional(),
});

export type GcpServiceAccount = z.infer<typeof serviceAccountSchema>;

/** "deployer@acme-commerce-prod.iam.gserviceaccount.com". */
export const serviceAccountEmail = (accountId: string, projectId: string) =>
  `${accountId}@${projectId}.iam.gserviceaccount.com`;

export function createIamClient(http: GcpHttp) {
  return {
    getServiceAccount(projectId: string, email: string): Promise<GcpServiceAccount | null> {
      return http.find({
        url: `${BASE}/projects/${projectId}/serviceAccounts/${email}`,
        schema: serviceAccountSchema,
      });
    },

    createServiceAccount(
      projectId: string,
      input: { accountId: string; displayName: string; description: string },
    ): Promise<GcpServiceAccount> {
      return http.send({
        method: 'POST',
        url: `${BASE}/projects/${projectId}/serviceAccounts`,
        body: {
          accountId: input.accountId,
          serviceAccount: { displayName: input.displayName, description: input.description },
        },
        schema: serviceAccountSchema,
      });
    },

    getServiceAccountPolicy(email: string): Promise<IamPolicy> {
      return http.send({
        method: 'POST',
        url: `${BASE}/projects/-/serviceAccounts/${email}:getIamPolicy`,
        schema: policySchema,
      });
    },

    async setServiceAccountPolicy(email: string, policy: IamPolicy): Promise<void> {
      await http.send({
        method: 'POST',
        url: `${BASE}/projects/-/serviceAccounts/${email}:setIamPolicy`,
        body: { policy },
        schema: policySchema,
      });
    },
  };
}

export type IamClient = ReturnType<typeof createIamClient>;
