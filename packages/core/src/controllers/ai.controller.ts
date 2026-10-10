import {
  aiModelRoleBodySchema,
  aiPreferencesBodySchema,
  aiPromptOverrideBodySchema,
  aiPromptParamsSchema,
  aiProviderCreateBodySchema,
  aiProviderDraftTestBodySchema,
  aiProviderUpdateBodySchema,
  aiRoleParamsSchema,
  aiRunFeedbackBodySchema,
  aiSettingsUpdateBodySchema,
  aiUsageQuerySchema,
  idParamsSchema,
  parseOrThrow,
} from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AuthenticateRequest } from '../contracts/authn.ts';
import { aiAdmin, type AiService } from '../services/ai/index.ts';

export interface AiControllerDependencies {
  authenticate: AuthenticateRequest;
  ai: AiService;
}

const catalogIdParams = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9][a-z0-9._-]*$/i)
    .max(128),
});
/** The upload is validated and trimmed by the catalog service, so only its envelope here. */
const catalogUploadBody = z.object({ data: z.record(z.string(), z.unknown()) });

/** Settings › AI under /admin/ai, and a person's own AI status, opt-out and feedback. */
export function createAiController(deps: AiControllerDependencies) {
  const ctx = deps.ai.context;
  const actor = (request: FastifyRequest) => deps.authenticate(request);
  const id = (request: FastifyRequest) => parseOrThrow(idParamsSchema, request.params).id;
  return {
    getSettings: async (r: FastifyRequest) => aiAdmin.getAiSettings(ctx, await actor(r)),
    updateSettings: async (r: FastifyRequest) =>
      aiAdmin.updateAiSettings(
        ctx,
        await actor(r),
        parseOrThrow(aiSettingsUpdateBodySchema, r.body ?? {}),
      ),
    usage: async (r: FastifyRequest) =>
      aiAdmin.getAiUsage(ctx, await actor(r), parseOrThrow(aiUsageQuerySchema, r.query ?? {})),
    exclusionTargets: async (r: FastifyRequest) =>
      aiAdmin.listExclusionTargets(ctx, await actor(r)),

    listProviders: async (r: FastifyRequest) => aiAdmin.listAiProviders(ctx, await actor(r)),
    async createProvider(r: FastifyRequest, reply: FastifyReply) {
      const created = await aiAdmin.createAiProvider(
        ctx,
        await actor(r),
        parseOrThrow(aiProviderCreateBodySchema, r.body),
      );
      reply.code(201);
      return created;
    },
    updateProvider: async (r: FastifyRequest) =>
      aiAdmin.updateAiProvider(
        ctx,
        await actor(r),
        id(r),
        parseOrThrow(aiProviderUpdateBodySchema, r.body ?? {}),
      ),
    async deleteProvider(r: FastifyRequest, reply: FastifyReply) {
      await aiAdmin.deleteAiProvider(ctx, await actor(r), id(r));
      reply.code(204);
    },
    testProvider: async (r: FastifyRequest) => aiAdmin.testAiProvider(ctx, await actor(r), id(r)),
    discoverProvider: async (r: FastifyRequest) =>
      aiAdmin.discoverAiProvider(ctx, await actor(r), id(r)),
    testDraft: async (r: FastifyRequest) =>
      aiAdmin.testDraftProvider(
        ctx,
        await actor(r),
        parseOrThrow(aiProviderDraftTestBodySchema, r.body),
      ),

    listRoles: async (r: FastifyRequest) => aiAdmin.listAiRoles(ctx, await actor(r)),
    putRole: async (r: FastifyRequest) =>
      aiAdmin.putAiRole(
        ctx,
        await actor(r),
        parseOrThrow(aiRoleParamsSchema, r.params).role,
        parseOrThrow(aiModelRoleBodySchema, r.body),
      ),
    async deleteRole(r: FastifyRequest, reply: FastifyReply) {
      await aiAdmin.deleteAiRole(
        ctx,
        await actor(r),
        parseOrThrow(aiRoleParamsSchema, r.params).role,
      );
      reply.code(204);
    },

    catalog: async (r: FastifyRequest) => aiAdmin.getAiCatalog(ctx, await actor(r)),
    catalogProvider: async (r: FastifyRequest) =>
      aiAdmin.getAiCatalogProvider(ctx, await actor(r), parseOrThrow(catalogIdParams, r.params).id),
    async catalogLogo(r: FastifyRequest, reply: FastifyReply) {
      const svg = await aiAdmin.getAiCatalogLogo(
        ctx,
        await actor(r),
        parseOrThrow(catalogIdParams, r.params).id,
      );
      // Third-party SVG on our origin: inert even if opened directly.
      reply
        .header('content-type', 'image/svg+xml')
        .header('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox")
        .header('x-content-type-options', 'nosniff')
        .header('cache-control', 'private, max-age=86400');
      return svg;
    },
    async uploadCatalog(r: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(catalogUploadBody, r.body);
      const result = await aiAdmin.uploadAiCatalog(ctx, await actor(r), body.data);
      reply.code(201);
      return result;
    },

    listPrompts: async (r: FastifyRequest) => aiAdmin.listAiPrompts(ctx, await actor(r)),
    diffPrompt: async (r: FastifyRequest) =>
      aiAdmin.diffAiPrompt(ctx, await actor(r), parseOrThrow(aiPromptParamsSchema, r.params).id),
    overridePrompt: async (r: FastifyRequest) =>
      aiAdmin.overrideAiPrompt(
        ctx,
        await actor(r),
        parseOrThrow(aiPromptParamsSchema, r.params).id,
        parseOrThrow(aiPromptOverrideBodySchema, r.body).template,
      ),
    async resetPrompt(r: FastifyRequest, reply: FastifyReply) {
      await aiAdmin.resetAiPrompt(
        ctx,
        await actor(r),
        parseOrThrow(aiPromptParamsSchema, r.params).id,
      );
      reply.code(204);
    },

    status: async (r: FastifyRequest) => aiAdmin.getAiStatus(ctx, deps.ai.facade, await actor(r)),
    setPreferences: async (r: FastifyRequest) =>
      aiAdmin.setAiPreferences(
        ctx,
        deps.ai.facade,
        await actor(r),
        parseOrThrow(aiPreferencesBodySchema, r.body),
      ),
    async setFeedback(r: FastifyRequest, reply: FastifyReply) {
      const who = await actor(r);
      await aiAdmin.assertAiOn(deps.ai.facade, who);
      await aiAdmin.setAiRunFeedback(
        ctx,
        who,
        id(r),
        parseOrThrow(aiRunFeedbackBodySchema, r.body).feedback,
      );
      reply.code(204);
    },
  };
}

export type AiController = ReturnType<typeof createAiController>;
