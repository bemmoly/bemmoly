import type { RequestContext } from '@bemmoly/core';
import { ValidationError } from '@bemmoly/shared';
import type { z } from 'zod';
import type { PipelineSpec } from '../../../../shared/pipeline-spec.ts';
import {
  savePipelineDefinitionBodySchema,
  savePipelineSetupBodySchema,
  type BuiltInTemplatesResponse,
  type PipelineSetup,
  type RepositoryFilesResponse,
  type SavedPipelineSetup,
  type SavePipelineDefinitionBody,
} from '../../../../shared/pipeline-setup.ts';
import { noPullRequests, type PullRequestOpener } from '../code/pull-requests.ts';
import { noRepositoryReader, type RepositoryReader } from '../code/repository-reader.ts';
import {
  authorizePipelines,
  requireAccess,
  requireDatabase,
  requirePerson,
  type PipelinesServiceDeps,
} from '../deps.ts';
import { setupApplication, templateContext, toSetup, type SetupApplicationRow } from './reads.ts';
import { candidateFiles, importFile } from './repository.ts';
import { proposeToRepository, storePipeline } from './store.ts';
import { builtInTemplates, definitionFrom, emptyDefinition } from './templates.ts';

export { builtInTemplates, definitionFrom } from './templates.ts';

/*
 * Setting up a service's pipeline (product rules 1, 6 and 8): three choices the person makes,
 * none made for them. Start empty, from a built-in template drawn from the environments that
 * exist, or from a file in the repository; keep it in Bemmoly or in the repository; number
 * versions one of four ways. Triggers start empty, so the pipeline runs only on Run until
 * someone adds one. Setting up and editing a pipeline needs `run` on the service.
 */

export interface PipelineSetupDeps extends PipelinesServiceDeps {
  pullRequests?: PullRequestOpener;
  repositories?: RepositoryReader;
}

export function createPipelineSetupService(deps: PipelineSetupDeps) {
  const ports = {
    pullRequests: deps.pullRequests ?? noPullRequests,
    repositories: deps.repositories ?? noRepositoryReader,
  };
  const authorize = (ctx: RequestContext, key: string) =>
    requireAccess(deps).authorizeAction(ctx, 'run', { application: key });

  async function treeOf(app: SetupApplicationRow) {
    if (!app.repository_full_name) return null;
    return ports.repositories
      .tree(app.repository_full_name, app.repository_default_branch ?? 'main')
      .catch(() => null);
  }

  async function fromRepository(app: SetupApplicationRow, path: string) {
    const tree = await treeOf(app);
    const content = tree ? await tree.read(path).catch(() => null) : null;
    if (content === null) {
      throw new ValidationError(
        `${path} could not be read from ${app.repository_full_name ?? app.key}`,
        {
          details: { fields: { repositoryFile: 'Not readable' } },
        },
      );
    }
    return importFile(content, path);
  }

  async function keep(
    ctx: RequestContext,
    app: SetupApplicationRow,
    setup: Omit<PipelineSetup, 'application'>,
    definition: PipelineSpec,
    skipped: string[],
  ): Promise<SavedPipelineSetup> {
    const sql = requireDatabase(deps);
    const person = requirePerson(ctx.actor);
    await storePipeline(sql, app, { setup, definition, createdBy: person });
    const proposed =
      setup.store === 'repository'
        ? await proposeToRepository(sql, ports, app, definition, person)
        : { url: null, reason: null };
    const stored = await setupApplication(sql, app.key);
    return {
      ...toSetup(stored),
      pullRequestUrl: proposed.url,
      pendingReason: proposed.reason,
      skipped,
    };
  }

  return {
    async get(ctx: RequestContext, key: string): Promise<PipelineSetup> {
      await authorizePipelines(ctx);
      return toSetup(await setupApplication(requireDatabase(deps), key));
    },

    async builtInTemplates(ctx: RequestContext): Promise<BuiltInTemplatesResponse> {
      await authorizePipelines(ctx);
      return { items: builtInTemplates(await templateContext(requireDatabase(deps))) };
    },

    async repositoryFiles(ctx: RequestContext, key: string): Promise<RepositoryFilesResponse> {
      await authorizePipelines(ctx);
      const app = await setupApplication(requireDatabase(deps), key);
      const tree = await treeOf(app);
      if (!tree) return { readable: false, items: [] };
      return { readable: true, items: candidateFiles(tree, app.path) };
    },

    async save(
      ctx: RequestContext,
      key: string,
      input: z.input<typeof savePipelineSetupBodySchema>,
    ) {
      const body = savePipelineSetupBodySchema.parse(input);
      await authorize(ctx, key);
      const sql = requireDatabase(deps);
      const app = await setupApplication(sql, key);
      let definition: PipelineSpec = emptyDefinition();
      let skipped: string[] = [];
      if (body.start === 'template' && body.template) {
        definition = definitionFrom(body.template, await templateContext(sql, app.path));
      } else if (body.start === 'repository' && body.repositoryFile) {
        const imported = await fromRepository(app, body.repositoryFile);
        if ('extends' in imported.definition) {
          throw new ValidationError('That file extends a template; edit it in the repository', {
            details: { fields: { repositoryFile: 'Extends a template' } },
          });
        }
        definition = imported.definition;
        skipped = imported.skipped;
      }
      return keep(
        ctx,
        app,
        {
          start: body.start,
          template: body.start === 'template' ? (body.template ?? null) : null,
          repositoryFile: body.start === 'repository' ? (body.repositoryFile ?? null) : null,
          store: body.store,
          versionScheme: body.versionScheme,
          triggers: body.triggers,
        },
        definition,
        skipped,
      );
    },

    /** The editor's Save: the whole pipeline as drawn and its triggers. */
    async saveDefinition(ctx: RequestContext, key: string, input: SavePipelineDefinitionBody) {
      const body = savePipelineDefinitionBodySchema.parse(input);
      await authorize(ctx, key);
      const app = await setupApplication(requireDatabase(deps), key);
      if (!app.pipeline_start || !app.pipeline_store || !app.version_scheme) {
        throw new ValidationError(`Set up ${key}'s pipeline before editing it`);
      }
      const setup = toSetup(app);
      return keep(ctx, app, { ...setup, triggers: body.triggers }, body.definition, []);
    },
  };
}

export type PipelineSetupService = ReturnType<typeof createPipelineSetupService>;
