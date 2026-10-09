import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { addTransition } from '../workflow/draft-transitions.ts';
import { moveStatus, updateStatus } from '../workflow/draft-model.ts';
import {
  backend,
  Providers,
  STATUS,
  testClient,
  useWorkflowBackend,
  WORKFLOW_ID,
} from '../workflow/testing.tsx';
import { useWorkflowDraft } from './workflow-draft.ts';
import { usePublishWorkflow } from './workflow-publish.ts';
import { useWorkflowValidation } from './workflow-validate.ts';

useWorkflowBackend({ beforeAll, afterAll, beforeEach, afterEach });

function renderEditorHooks(onPublished = vi.fn()) {
  const client = testClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Providers client={client}>{children}</Providers>
  );
  return renderHook(
    () => {
      const draft = useWorkflowDraft(WORKFLOW_ID);
      const validation = useWorkflowValidation(WORKFLOW_ID, draft.flush);
      const publisher = usePublishWorkflow(WORKFLOW_ID, draft.flush, onPublished);
      return { draft, validation, publisher };
    },
    { wrapper },
  );
}

describe('useWorkflowDraft', () => {
  it('lays out a published workflow that carries no coordinates', async () => {
    const { result } = renderEditorHooks();
    await waitFor(() => expect(result.current.draft.draft).toBeDefined());
    const [backlog, progress] = result.current.draft.draft?.statuses ?? [];
    expect([backlog?.x, backlog?.y]).toEqual([110, 120]);
    expect([progress?.x, progress?.y]).toEqual([300, 120]);
    expect(result.current.draft.saveState).toBe('saved');
  });

  it('saves the last of several quick edits once, after the pause', async () => {
    const { result } = renderEditorHooks();
    await waitFor(() => expect(result.current.draft.draft).toBeDefined());
    act(() => {
      result.current.draft.edit((draft) => moveStatus(draft, STATUS.done, 500, 400));
      result.current.draft.edit((draft) => updateStatus(draft, STATUS.done, { name: 'Shipped' }));
    });
    expect(result.current.draft.saveState).toBe('pending');
    expect(backend.saved).toHaveLength(0);
    await waitFor(() => expect(result.current.draft.saveState).toBe('saved'), { timeout: 3000 });
    expect(backend.saved).toHaveLength(1);
    const done = backend.saved[0]?.statuses.find((status) => status.id === STATUS.done);
    expect(done).toMatchObject({ name: 'Shipped', x: 500, y: 400 });
  });
});

describe('useWorkflowValidation', () => {
  it('saves the waiting edit first, then marks what the problems name', async () => {
    const { result } = renderEditorHooks();
    await waitFor(() => expect(result.current.draft.draft).toBeDefined());
    act(() => {
      result.current.draft.edit(
        (draft) => addTransition(draft, STATUS.progress, STATUS.done).draft,
      );
    });
    backend.problems = [
      {
        code: 'unreachable_status',
        message: 'No transition leads to "Done"',
        statusId: STATUS.done,
      },
    ];
    let problems: unknown[] = [];
    await act(async () => {
      problems = await result.current.validation.run();
    });
    expect(backend.saved).toHaveLength(1);
    expect(backend.saved[0]?.transitions).toHaveLength(2);
    expect(problems).toHaveLength(1);
    expect(result.current.validation.invalidStatuses.has(STATUS.done)).toBe(true);
    expect(result.current.validation.invalidTransitions.size).toBe(0);
  });
});

describe('usePublishWorkflow', () => {
  it('reads where removed statuses must go, then publishes with the answer', async () => {
    const onPublished = vi.fn();
    const { result } = renderEditorHooks(onPublished);
    await waitFor(() => expect(result.current.draft.draft).toBeDefined());
    backend.mappingRequired = [{ statusId: STATUS.backlog, name: 'Backlog', issues: 4 }];

    await act(async () => {
      await result.current.publisher.publish().catch(() => undefined);
    });
    expect(result.current.publisher.refusal.statusMappingRequired).toEqual([
      { statusId: STATUS.backlog, name: 'Backlog', issues: 4 },
    ]);
    expect(onPublished).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.publisher.publish({ [STATUS.backlog]: STATUS.progress });
    });
    expect(onPublished).toHaveBeenCalledWith(expect.objectContaining({ publishedVersion: 4 }));
    expect(backend.workflow.publishedVersion).toBe(4);
  });
});
