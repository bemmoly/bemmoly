import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyRequest } from 'fastify';
import { applicationKeyParamsSchema } from '../../../shared/catalog.ts';
import {
  savePipelineDefinitionBodySchema,
  savePipelineSetupBodySchema,
} from '../../../shared/pipeline-setup.ts';
import type { PipelineSetupService } from '../services/pipeline-setup/index.ts';

/** A service's pipeline setup, the editor's save, and the built-in templates. */
export function createPipelineSetupController(setup: PipelineSetupService) {
  return {
    get(request: FastifyRequest) {
      const { key } = parseOrThrow(applicationKeyParamsSchema, request.params);
      return setup.get(contextOf(request), key);
    },
    save(request: FastifyRequest) {
      const { key } = parseOrThrow(applicationKeyParamsSchema, request.params);
      const body = parseOrThrow(savePipelineSetupBodySchema, request.body);
      return setup.save(contextOf(request), key, body);
    },
    saveDefinition(request: FastifyRequest) {
      const { key } = parseOrThrow(applicationKeyParamsSchema, request.params);
      const body = parseOrThrow(savePipelineDefinitionBodySchema, request.body);
      return setup.saveDefinition(contextOf(request), key, body);
    },
    repositoryFiles(request: FastifyRequest) {
      const { key } = parseOrThrow(applicationKeyParamsSchema, request.params);
      return setup.repositoryFiles(contextOf(request), key);
    },
    builtInTemplates(request: FastifyRequest) {
      return setup.builtInTemplates(contextOf(request));
    },
  };
}

export type PipelineSetupController = ReturnType<typeof createPipelineSetupController>;
