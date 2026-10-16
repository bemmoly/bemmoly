import { z } from 'zod';
import type { GcpHttp } from './http.ts';

/* Cloud Billing v1: which billing account pays for a project, and how many it pays for. */

const BASE = 'https://cloudbilling.googleapis.com/v1';

const billingInfoSchema = z.object({
  name: z.string().optional(),
  projectId: z.string().optional(),
  billingAccountName: z.string().default(''),
  billingEnabled: z.boolean().default(false),
});

export type ProjectBillingInfo = z.infer<typeof billingInfoSchema>;

export function createBillingClient(http: GcpHttp) {
  return {
    getProjectBilling(projectId: string): Promise<ProjectBillingInfo> {
      return http.send({
        url: `${BASE}/projects/${projectId}/billingInfo`,
        schema: billingInfoSchema,
      });
    },

    /** Links the project to `billingAccountId` ("01ABCD-23EF45-67890A"). */
    linkProject(projectId: string, billingAccountId: string): Promise<ProjectBillingInfo> {
      return http.send({
        method: 'PUT',
        url: `${BASE}/projects/${projectId}/billingInfo`,
        body: { billingAccountName: `billingAccounts/${billingAccountId}` },
        schema: billingInfoSchema,
      });
    },

    /** Null when the caller cannot see the billing account at all. */
    getAccount(billingAccountId: string) {
      return http.find({
        url: `${BASE}/billingAccounts/${billingAccountId}`,
        schema: z.object({
          name: z.string(),
          open: z.boolean().default(false),
          displayName: z.string().optional(),
        }),
      });
    },

    async testPermissions(billingAccountId: string, permissions: string[]): Promise<string[]> {
      const answer = await http.send({
        method: 'POST',
        url: `${BASE}/billingAccounts/${billingAccountId}:testIamPermissions`,
        body: { permissions },
        schema: z.object({ permissions: z.array(z.string()).default([]) }),
      });
      return answer.permissions;
    },

    /** Projects the account pays for now; new billing accounts may link only a few. */
    async countLinkedProjects(billingAccountId: string): Promise<number> {
      let count = 0;
      let pageToken: string | undefined;
      do {
        const page = await http.send({
          url: `${BASE}/billingAccounts/${billingAccountId}/projects`,
          query: { pageToken, pageSize: 200 },
          schema: z.object({
            projectBillingInfo: z.array(billingInfoSchema).default([]),
            nextPageToken: z.string().optional(),
          }),
        });
        count += page.projectBillingInfo.filter((info) => info.billingEnabled).length;
        pageToken = page.nextPageToken || undefined;
      } while (pageToken);
      return count;
    },
  };
}

export type BillingClient = ReturnType<typeof createBillingClient>;
