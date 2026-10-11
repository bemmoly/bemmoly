import { defineReadTool, defineWriteTool } from '@bemmoly/core';
import { z } from 'zod';
import { projectRefParamsSchema } from '../../../../shared/boards.ts';
import { createProjectBodySchema } from '../../../../shared/projects.ts';
import { WORK_MODULE } from '../projects/rows.ts';
import type { WorkServices } from '../index.ts';
import { projectStatuses } from './resolve.ts';

/*
 * Projects and their workflow statuses: what a client reads before it creates issues, and the
 * project it may create to hold them. Creating one is authorized as the projects service does.
 */

const projectHref = (key: string) => `/work/board/${key}`;

const listInput = z.object({ archived: z.boolean().default(false) });

export function projectTools(services: WorkServices) {
  const listProjects = defineReadTool({
    name: 'work_list_projects',
    kind: 'read',
    description: 'The projects the person can see: id, key and name.',
    input: listInput,
    execute: async (ctx, { archived }) => {
      const projects: { id: string; key: string; name: string }[] = [];
      let cursor: string | undefined;
      do {
        const page = await services.projects.list(ctx, {
          limit: 200,
          archived,
          ...(cursor ? { cursor } : {}),
        });
        projects.push(...page.items.map(({ id, key, name }) => ({ id, key, name })));
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
      return projects;
    },
  });

  const listStatuses = defineReadTool({
    name: 'work_list_statuses',
    kind: 'read',
    description:
      "A project's workflow statuses by project key, in order: id, name, category (todo, " +
      'in_progress, done) and position. Any of them can be the status of a new issue.',
    input: projectRefParamsSchema,
    execute: async (ctx, { key }) => {
      const project = await services.projects.get(ctx, key);
      return (await projectStatuses(services, ctx, project.id)).map((status) => ({
        id: status.id,
        name: status.name,
        category: status.category,
        position: status.position,
      }));
    },
  });

  const createProject = defineWriteTool<z.infer<typeof createProjectBodySchema>, never>({
    name: 'work_create_project',
    kind: 'write',
    description:
      'Create a project: key (2 to 10 capitals, the prefix of its issue keys), name and an ' +
      'optional description. Returns the id, key and href.',
    input: createProjectBodySchema,
    idempotent: false,
    describe: async (_ctx, input) => ({
      target: input.key.toUpperCase(),
      change: input.name,
      field: 'New project',
      from: null,
      to: null,
      href: null,
    }),
    authorize: async (ctx) => {
      await ctx.authz.authorize(ctx.actor, 'work.project.create', WORK_MODULE);
    },
    run: async (ctx, input) => {
      const project = await services.projects.create(ctx, input);
      return { result: { id: project.id, key: project.key, href: projectHref(project.key) } };
    },
  });

  return [listProjects, listStatuses, createProject];
}
