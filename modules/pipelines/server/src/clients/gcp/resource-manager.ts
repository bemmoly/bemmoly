import { z } from 'zod';
import type { GcpHttp } from './http.ts';
import { operationSchema, waitForOperation, type PollOptions } from './operations.ts';
import { policySchema, type IamPolicy } from './policy.ts';

/* Cloud Resource Manager v3: folders, projects and project IAM policies. */

const BASE = 'https://cloudresourcemanager.googleapis.com/v3';

const folderSchema = z.object({
  name: z.string(),
  displayName: z.string().optional(),
  parent: z.string().optional(),
  state: z.string().optional(),
});

const projectSchema = z.object({
  name: z.string(),
  projectId: z.string(),
  displayName: z.string().optional(),
  parent: z.string().optional(),
  state: z.string().optional(),
  labels: z.record(z.string(), z.string()).default({}),
});

const permissionsSchema = z.object({ permissions: z.array(z.string()).default([]) });

export type GcpFolder = z.infer<typeof folderSchema>;
export type GcpProject = z.infer<typeof projectSchema>;

export function createResourceManagerClient(http: GcpHttp, poll: PollOptions) {
  return {
    /** The folder named `displayName` directly under `parent`, if there is one. */
    async findFolder(parent: string, displayName: string): Promise<GcpFolder | null> {
      const answer = await http.send({
        url: `${BASE}/folders:search`,
        query: { query: `displayName="${displayName}" AND parent=${parent} AND state=ACTIVE` },
        schema: z.object({ folders: z.array(folderSchema).default([]) }),
      });
      return answer.folders[0] ?? null;
    },

    async createFolder(parent: string, displayName: string): Promise<GcpFolder> {
      const operation = await http.send({
        method: 'POST',
        url: `${BASE}/folders`,
        body: { parent, displayName },
        schema: operationSchema,
      });
      return folderSchema.parse(await waitForOperation(http, BASE, operation, poll));
    },

    /** Which of `permissions` the caller holds on a folder or organization. */
    async testPermissions(resource: string, permissions: string[]): Promise<string[]> {
      const answer = await http.send({
        method: 'POST',
        url: `${BASE}/${resource}:testIamPermissions`,
        body: { permissions },
        schema: permissionsSchema,
      });
      return answer.permissions;
    },

    getProject(projectId: string): Promise<GcpProject | null> {
      return http.find({ url: `${BASE}/projects/${projectId}`, schema: projectSchema });
    },

    /** Every project matching a Resource Manager query, such as "labels.managed-by:bemmoly". */
    async searchProjects(query: string): Promise<GcpProject[]> {
      const projects: GcpProject[] = [];
      let pageToken: string | undefined;
      do {
        const page = await http.send({
          url: `${BASE}/projects:search`,
          query: { query, pageToken, pageSize: 500 },
          schema: z.object({
            projects: z.array(projectSchema).default([]),
            nextPageToken: z.string().optional(),
          }),
        });
        projects.push(...page.projects);
        pageToken = page.nextPageToken || undefined;
      } while (pageToken);
      return projects;
    },

    async createProject(input: {
      projectId: string;
      displayName: string;
      parent: string;
      labels: Readonly<Record<string, string>>;
    }): Promise<GcpProject> {
      const operation = await http.send({
        method: 'POST',
        url: `${BASE}/projects`,
        body: input,
        schema: operationSchema,
      });
      return projectSchema.parse(await waitForOperation(http, BASE, operation, poll));
    },

    async updateProjectLabels(
      projectId: string,
      labels: Readonly<Record<string, string>>,
    ): Promise<void> {
      const operation = await http.send({
        method: 'PATCH',
        url: `${BASE}/projects/${projectId}`,
        query: { updateMask: 'labels' },
        body: { labels },
        schema: operationSchema,
      });
      await waitForOperation(http, BASE, operation, poll);
    },

    getProjectPolicy(projectId: string): Promise<IamPolicy> {
      return http.send({
        method: 'POST',
        url: `${BASE}/projects/${projectId}:getIamPolicy`,
        body: { options: { requestedPolicyVersion: 3 } },
        schema: policySchema,
      });
    },

    async setProjectPolicy(projectId: string, policy: IamPolicy): Promise<void> {
      await http.send({
        method: 'POST',
        url: `${BASE}/projects/${projectId}:setIamPolicy`,
        body: { policy: { ...policy, version: 3 } },
        schema: policySchema,
      });
    },
  };
}

export type ResourceManagerClient = ReturnType<typeof createResourceManagerClient>;
