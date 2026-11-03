import type { Http } from '@bemmoly/api-client';
import {
  builtInTemplatesResponseSchema,
  PIPELINE_SETUP_PATHS,
  pipelineSetupSchema,
} from '@bemmoly/module-pipelines/shared';

/** A service's pipeline setup and the built-in templates (stream S4 fills these in). */
export const pipelineSetupKeys = {
  all: ['pipelines', 'pipeline-setup'] as const,
  setup: (application: string) =>
    ['pipelines', 'application', application, 'pipeline-setup'] as const,
  builtInTemplates: () => ['pipelines', 'pipeline-setup', 'built-in-templates'] as const,
};

export function pipelineSetupEndpoints(http: Http) {
  return {
    setup: (application: string) =>
      http.request(PIPELINE_SETUP_PATHS.setup(application), pipelineSetupSchema),
    builtInTemplates: () =>
      http.request(PIPELINE_SETUP_PATHS.builtInTemplates, builtInTemplatesResponseSchema),
  };
}
