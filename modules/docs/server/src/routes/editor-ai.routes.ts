import type { FastifyPluginAsync } from 'fastify';
import type { EditorAiController } from '../controllers/editor-ai.controller.ts';

/** AI inside the editor: ghost text, /ai writes (NDJSON) and a comment thread's fix. */
export function editorAiRoutes(controller: EditorAiController): FastifyPluginAsync {
  return async (app) => {
    app.post('/pages/:pageId/completions', async (request, reply) =>
      controller.complete(request, reply),
    );
    app.post('/pages/:pageId/ai-writes', async (request, reply) =>
      controller.write(request, reply),
    );
    app.post('/comments/:commentId/suggest-fix', async (request) => controller.suggestFix(request));
  };
}
