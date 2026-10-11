import type { APIRequestContext, APIResponse } from '@playwright/test';

/*
 * The Work API as a test arranges data with it: only what a flow does not
 * exercise through the screen. Every call goes through the public routes,
 * so arranging never writes a row the server would not have written.
 */

export interface ProjectRef {
  id: string;
  key: string;
  name: string;
}

export interface IssueRef {
  id: string;
  key: string;
  number: number;
  title: string;
  statusId: string;
}

export interface Named {
  id: string;
  name: string;
}

const RETRIES = 3;

export class WorkApi {
  readonly http: APIRequestContext;

  constructor(http: APIRequestContext) {
    this.http = http;
  }

  /** A JSON call that throws with the server's body when it does not succeed. */
  async call<T>(method: string, path: string, data?: unknown): Promise<T> {
    let response: APIResponse | undefined;
    for (let attempt = 0; attempt < RETRIES; attempt += 1) {
      response = await this.http.fetch(`/api/v1${path}`, {
        method,
        ...(data === undefined ? {} : { data }),
      });
      if (response.status() !== 429) break;
      // The per-person budget is a fixed window; wait for it rather than fail the arrangement.
      const wait = Number(response.headers()['retry-after'] ?? '5');
      await new Promise((resolve) => setTimeout(resolve, Math.min(wait, 60) * 1000));
    }
    if (!response?.ok()) {
      throw new Error(`${method} ${path}: ${response?.status()} ${await response?.text()}`);
    }
    return (response.status() === 204 ? undefined : await response.json()) as T;
  }

  createProject(input: {
    key: string;
    name: string;
    method?: 'scrum' | 'kanban';
    teamId?: string;
  }): Promise<ProjectRef> {
    return this.call('POST', '/work/projects', input);
  }

  async typeId(projectKey: string, typeKey = 'task'): Promise<string> {
    const { items } = await this.call<{ items: { id: string; key: string }[] }>(
      'GET',
      `/work/projects/${projectKey}/issue-types`,
    );
    const type = items.find((item) => item.key === typeKey);
    if (!type) throw new Error(`no ${typeKey} type in ${projectKey}`);
    return type.id;
  }

  createIssue(input: {
    projectId: string;
    typeId: string;
    title: string;
    assigneeId?: string;
    estimate?: number;
  }): Promise<IssueRef> {
    return this.call('POST', '/work/issues', input);
  }

  async createIssues(project: ProjectRef, titles: string[], typeKey = 'task') {
    const typeId = await this.typeId(project.key, typeKey);
    const issues: IssueRef[] = [];
    for (const title of titles) {
      issues.push(await this.createIssue({ projectId: project.id, typeId, title }));
    }
    return issues;
  }

  issue(key: string): Promise<IssueRef & { sprintId: string | null }> {
    return this.call('GET', `/work/issues/${key}`);
  }

  async boardId(projectKey: string): Promise<string> {
    const { items } = await this.call<{ items: Named[] }>(
      'GET',
      `/work/projects/${projectKey}/boards`,
    );
    const [board] = items;
    if (!board) throw new Error(`no board in ${projectKey}`);
    return board.id;
  }

  addMembers(projectKey: string, userIds: string[]) {
    return this.call('POST', `/work/projects/${projectKey}/members`, { userIds });
  }

  /** Takes an issue through the workflow, one transition per status name, as people would. */
  async walk(issueKey: string, statusNames: string[]): Promise<void> {
    for (const name of statusNames) {
      const { items } = await this.call<{ items: { toStatusId: string; toStatusName: string }[] }>(
        'GET',
        `/work/issues/${issueKey}/transitions`,
      );
      const next = items.find((item) => item.toStatusName === name);
      if (!next) throw new Error(`${issueKey} has no transition to ${name}`);
      await this.call('PATCH', `/work/issues/${issueKey}`, { statusId: next.toStatusId });
    }
  }
}
