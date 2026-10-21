import type { ModuleContext } from '@bemmoly/core';
import type { FastifyPluginAsync } from 'fastify';
import { createAskReportsController } from '../controllers/ask-reports.controller.ts';
import { askReportsRoutes } from '../routes/ask-reports.routes.ts';
import { ASK_REPORT_PROMPT_FILE, createAskReportsServices } from '../services/ask-reports/index.ts';

/**
 * Asked and pinned reports join the module here: the prompt file, and the routes the module
 * mounts beside the rest of Work under /work. They own their table and services, so nothing
 * else in Work depends on them. With AI off, asking refuses with `ai_off` and pinned reports
 * keep working.
 */
export function registerAskReports(
  ctx: Pick<ModuleContext, 'ai' | 'database'>,
): FastifyPluginAsync {
  ctx.ai.addPromptFile(ASK_REPORT_PROMPT_FILE);
  const services = createAskReportsServices({
    ...(ctx.database ? { database: ctx.database } : {}),
    ai: ctx.ai,
  });
  return askReportsRoutes(createAskReportsController(services));
}
