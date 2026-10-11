import { describe, expect, it } from 'vitest';
import { createMockApi } from '../dispatch.ts';
import { historyState } from './docs-history-state.ts';
import { docsState } from './docs-state.ts';

/* The editor's AI in the mock backend answers as the server does, so the demo shows it all. */

const URL = 'http://mock.local/api/v1';
type Api = ReturnType<typeof createMockApi>;

function setup() {
  const api = createMockApi('ready');
  const page = docsState(api.db).pages.find((row) => !row.deletedAt)!;
  return { api, page };
}

const write = (api: Api, pageId: string, body: unknown) =>
  api.dispatch('POST', `${URL}/docs/pages/${pageId}/ai-writes`, body);

describe('the editor AI mock', () => {
  it('continues a line, and stays quiet on a short one', () => {
    const { api, page } = setup();
    const ask = (before: string) =>
      api.dispatch('POST', `${URL}/docs/pages/${page.id}/completions`, { before })?.body as {
        text: string | null;
      };
    expect(ask('Sessions move to Postgres').text).toMatch(/^ /);
    expect(ask('Hi').text).toBeNull();
  });

  it('streams every /ai command as NDJSON that ends in done', () => {
    const { api, page } = setup();
    for (const command of ['continue', 'improve', 'table', 'summarize-comments']) {
      const reply = write(api, page.id, {
        command,
        targetText: 'we moves sessions',
        heading: 'Plan',
      });
      expect(reply?.headers?.['content-type']).toContain('application/x-ndjson');
      const events = String(reply?.body)
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as { type: string });
      expect(events.at(-1)).toEqual({ type: 'done', runId: null });
      expect(events.filter((event) => event.type === 'text').length).toBeGreaterThan(0);
    }
  });

  it('refuses with a reason when AI is off or the space is excluded', () => {
    const { api, page } = setup();
    const space = docsState(api.db).spaces.find((row) => row.id === page.spaceId)!;
    space.aiExcluded = true;
    expect(write(api, page.id, { command: 'continue' })?.body).toMatchObject({
      details: { reason: 'excluded' },
    });
    space.aiExcluded = false;
    api.dispatch('PATCH', `${URL}/admin/ai/settings`, { privacy: { enabled: false } });
    expect(write(api, page.id, { command: 'continue' })).toMatchObject({
      status: 403,
      body: { details: { reason: 'ai_off' } },
    });
  });

  it('writes a fix onto an anchored thread', () => {
    const { api } = setup();
    const thread = historyState(api.db).comments.find((row) => row.anchor && !row.parentId)!;
    thread.aiSuggestion = null;
    const reply = api.dispatch('POST', `${URL}/docs/comments/${thread.id}/suggest-fix`, {});
    const comment = reply?.body as {
      aiSuggestion: { replacement: string; runId: string; appliedAt: null } | null;
    };
    expect(comment.aiSuggestion?.replacement).toBeTruthy();
    // A run to mark: the fix card offers Not useful, as every AI card does.
    expect(comment.aiSuggestion?.runId).toMatch(/^[0-9a-f-]{36}$/);
    expect(comment.aiSuggestion?.appliedAt).toBeNull();
  });
});
