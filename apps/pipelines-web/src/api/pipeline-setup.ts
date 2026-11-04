import type { Http } from '@bemmoly/api-client';
import {
  builtInTemplatesResponseSchema,
  PIPELINE_SETUP_PATHS,
  pipelineSetupSchema,
  repositoryFilesResponseSchema,
  RUN_NEXT_PATHS,
  runNextSchema,
  savedPipelineSetupSchema,
  type SavePipelineDefinitionBody,
  type SavePipelineSetupBody,
} from '@bemmoly/module-pipelines/shared';

/** A service's pipeline setup, the editor's save, built-in templates and where a run's version goes. */
export const pipelineSetupKeys = {
  all: ['pipelines', 'pipeline-setup'] as const,
  setup: (application: string) =>
    ['pipelines', 'application', application, 'pipeline-setup'] as const,
  repositoryFiles: (application: string) =>
    ['pipelines', 'application', application, 'pipeline-setup', 'files'] as const,
  builtInTemplates: () => ['pipelines', 'pipeline-setup', 'built-in-templates'] as const,
  whereNext: (runId: string) => ['pipelines', 'run', runId, 'where-next'] as const,
};

export function pipelineSetupEndpoints(http: Http) {
  return {
    setup: (application: string) =>
      http.request(PIPELINE_SETUP_PATHS.setup(application), pipelineSetupSchema),
    save: (application: string, body: Omit<SavePipelineSetupBody, 'triggers'>) =>
      http.request(PIPELINE_SETUP_PATHS.setup(application), savedPipelineSetupSchema, {
        method: 'PUT',
        body,
      }),
    saveDefinition: (application: string, body: SavePipelineDefinitionBody) =>
      http.request(PIPELINE_SETUP_PATHS.definition(application), savedPipelineSetupSchema, {
        method: 'PUT',
        body,
      }),
    repositoryFiles: (application: string) =>
      http.request(
        PIPELINE_SETUP_PATHS.repositoryFiles(application),
        repositoryFilesResponseSchema,
      ),
    builtInTemplates: () =>
      http.request(PIPELINE_SETUP_PATHS.builtInTemplates, builtInTemplatesResponseSchema),
    whereNext: (runId: string) => http.request(RUN_NEXT_PATHS.whereNext(runId), runNextSchema),
  };
}
