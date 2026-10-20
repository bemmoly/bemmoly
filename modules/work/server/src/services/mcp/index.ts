import type { ModuleContext, RequestContext } from '@bemmoly/core';
import { listProjectsQuerySchema, type Project } from '../../../../shared/projects.ts';
import type { IssueDetail } from '../../../../shared/issues.ts';
import type { WorkServices } from '../index.ts';

/*
 * What Work offers MCP clients besides its AI tools: projects and issues as resources a client
 * can read and attach, and a triage prompt. Every read goes through the service the screens
 * call, as the person behind the token.
 */

const issueUri = (key: string) => `bemmoly://work/issues/${encodeURIComponent(key)}`;
const projectUri = (key: string) => `bemmoly://work/projects/${encodeURIComponent(key)}`;

export function issueMarkdown(issue: IssueDetail): string {
  const facts = [
    `- Status: ${issue.status.name} (${issue.status.category})`,
    `- Type: ${issue.type.name}`,
    `- Priority: ${issue.priority}`,
    `- Assignee: ${issue.assignee?.name ?? 'Unassigned'}`,
    `- Sprint: ${issue.sprint?.name ?? 'None'}`,
    `- Labels: ${issue.labels.map((label) => label.name).join(', ') || 'None'}`,
  ];
  const links = issue.links.map(
    (link) =>
      `- ${link.inverse ? `${link.kind} (inverse)` : link.kind} ${link.issue.key}: ${link.issue.title}`,
  );
  return [
    `# ${issue.key} ${issue.title}`,
    '',
    ...facts,
    '',
    '## Description',
    '',
    issue.descriptionText.trim() || '_No description._',
    ...(links.length > 0 ? ['', '## Links', '', ...links] : []),
    '',
  ].join('\n');
}

function projectMarkdown(project: Project, issues: { key: string; title: string }[]): string {
  return [
    `# ${project.key} ${project.name}`,
    '',
    project.description?.trim() || '_No description._',
    '',
    '## Recent issues',
    '',
    ...(issues.length > 0
      ? issues.map((issue) => `- ${issue.key}: ${issue.title}`)
      : ['_No issues yet._']),
    '',
  ].join('\n');
}

async function recentIssues(services: WorkServices, ctx: RequestContext, projectId: string) {
  const page = await services.issues.list(ctx, {
    projectId,
    limit: 25,
    sort: 'updated',
    order: 'desc',
    deleted: false,
    archived: false,
  });
  return page.items.map((issue) => ({ key: issue.key, title: issue.title }));
}

/** Registers Work's MCP resources and prompts with the kernel. */
export function registerWorkMcp(mcp: ModuleContext['mcp'], services: WorkServices): void {
  mcp.addResource({
    name: 'work.project',
    title: 'Project',
    description: 'A Work project by key: its description and most recently updated issues.',
    uriTemplate: 'bemmoly://work/projects/{key}',
    list: async (ctx) => {
      const page = await services.projects.list(ctx, listProjectsQuerySchema.parse({ limit: 100 }));
      return page.items.map((project) => ({
        uri: projectUri(project.key),
        name: project.key,
        title: project.name,
        ...(project.description ? { description: project.description } : {}),
      }));
    },
    read: async (ctx, { key = '' }) => {
      const project = await services.projects.get(ctx, key);
      return { text: projectMarkdown(project, await recentIssues(services, ctx, project.id)) };
    },
  });
  mcp.addResource({
    name: 'work.issue',
    title: 'Issue',
    description: 'A Work issue by key (PLT-204): status, people, sprint, description and links.',
    uriTemplate: 'bemmoly://work/issues/{key}',
    read: async (ctx, { key = '' }) => ({
      text: issueMarkdown(await services.issues.get(ctx, key)),
    }),
  });
  mcp.addPrompt({
    name: 'work.triage_issue',
    title: 'Triage an issue',
    description: 'Read an issue and suggest its priority, assignee and next step.',
    arguments: [{ name: 'key', description: 'The issue key, e.g. PLT-204', required: true }],
    render: async (ctx, { key = '' }) => {
      const issue = await services.issues.get(ctx, key);
      return [
        {
          role: 'user',
          text:
            'Triage this issue. Suggest a priority, who should own it and the next step, ' +
            `and say why in a sentence each. Its resource is ${issueUri(issue.key)}.\n\n` +
            issueMarkdown(issue),
        },
      ];
    },
  });
}
