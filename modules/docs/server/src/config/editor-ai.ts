import type { ModuleContext } from '@bemmoly/core';
import { createEditorAiController } from '../controllers/editor-ai.controller.ts';
import { editorAiRoutes } from '../routes/editor-ai.routes.ts';
import type { DocsServices } from '../services/index.ts';
import { createEditorAiService } from '../services/editor-ai/index.ts';
import { EDITOR_PROMPT_FILES } from '../services/editor-ai/prompts.ts';

/**
 * AI inside the editor joins the module here: its prompt files, and its routes beside the
 * rest of Docs. With AI off every call refuses with `ai_off`, and the web hides the surfaces.
 */
export function registerEditorAi(
  ctx: Pick<ModuleContext, 'ai' | 'routes' | 'database'>,
  services: Pick<DocsServices, 'comments'>,
): void {
  for (const prompt of EDITOR_PROMPT_FILES) ctx.ai.addPromptFile(prompt);
  const service = createEditorAiService({
    ...(ctx.database ? { database: ctx.database } : {}),
    ai: ctx.ai,
    attachSuggestion: (commentId, suggestion) =>
      services.comments.attachSuggestion(commentId, suggestion),
  });
  ctx.routes.add({ prefix: '/docs', plugin: editorAiRoutes(createEditorAiController(service)) });
}
