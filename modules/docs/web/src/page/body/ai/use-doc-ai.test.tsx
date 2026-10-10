import { ApiError, queryKeys } from '@bemmoly/api-client';
import { writePreference } from '@bemmoly/core-web';
import type { AiWriteEvent } from '@bemmoly/editor';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../shared/api.ts';
import { docsKeys } from '../../../shared/keys.ts';
import { newClient, providers, space } from '../../../test-support.tsx';
import { describeAiError } from './describe-ai-error.ts';
import { GHOST_TEXT_PREFERENCE, useDocAi } from './use-doc-ai.ts';

afterEach(() => {
  vi.restoreAllMocks();
  writePreference(GHOST_TEXT_PREFERENCE, true);
});

const PAGE = '0199c0de-0000-7000-8000-000000000071';

function hook({ aiEnabled = true, editable = true, excluded = false, optedOut = false } = {}) {
  const client = newClient();
  client.setQueryData(queryKeys.me(), {
    user: { id: 'u-1', name: 'Rohan' },
    workspace: { name: 'Acme', aiEnabled },
    capabilities: [],
    modules: ['docs'],
  });
  client.setQueryData(docsKeys.space('ENG'), space({ aiExcluded: excluded }));
  client.setQueryData(queryKeys.ai.status(), {
    enabled: aiEnabled,
    optedOut,
    optOutAllowed: true,
    allowActions: true,
    availableRoles: ['fast', 'standard', 'strong'],
    budgetState: 'unlimited',
  });
  return renderHook(() => useDocAi({ pageId: PAGE, spaceKey: 'ENG', editable }), {
    wrapper: providers(client),
  });
}

async function* events(...list: unknown[]) {
  for (const event of list) yield event as never;
}

async function collect(stream: AsyncIterable<AiWriteEvent>) {
  const out: AiWriteEvent[] = [];
  for await (const event of stream) out.push(event);
  return out;
}

const REQUEST = { commandId: 'improve', targetText: 'x', sectionText: 'x', heading: 'H' };

describe('the Docs editor’s AI', () => {
  it('lends nothing with AI off, to a reader, in an excluded space or after opting out', () => {
    expect(hook({ aiEnabled: false }).result.current).toBeUndefined();
    expect(hook({ editable: false }).result.current).toBeUndefined();
    expect(hook({ excluded: true }).result.current).toBeUndefined();
    expect(hook({ optedOut: true }).result.current).toBeUndefined();
    expect(hook().result.current).toBeDefined();
  });

  it('follows the person’s ghost text switch', () => {
    const { result } = hook();
    expect(result.current?.ghostText).toBe(true);
    act(() => writePreference(GHOST_TEXT_PREFERENCE, false));
    expect(result.current?.ghostText).toBe(false);
  });

  it('streams a write, and turns an error line into an honest failure', async () => {
    const write = vi.spyOn(api.docs.ai, 'write');
    write.mockReturnValueOnce(
      events(
        { type: 'text', text: 'We ' },
        { type: 'text', text: 'move' },
        { type: 'done', runId: null },
      ),
    );
    const ai = hook().result.current!;
    const signal = new AbortController().signal;
    expect(await collect(ai.write!(REQUEST, signal))).toEqual([
      { type: 'text', text: 'We ' },
      { type: 'text', text: 'move' },
      { type: 'done', runId: null },
    ]);
    expect(write).toHaveBeenCalledWith(
      PAGE,
      { command: 'improve', targetText: 'x', sectionText: 'x', heading: 'H' },
      signal,
    );

    write.mockReturnValueOnce(
      events({
        type: 'error',
        code: 'provider_error',
        message: 'The provider returned a rate limit.',
      }),
    );
    const failure = await collect(ai.write!(REQUEST, signal)).catch((error: unknown) => error);
    expect(describeAiError(failure)).toBe('The provider returned a rate limit.');
  });

  it('stops asking for ghost text once the server refuses it', async () => {
    const complete = vi
      .spyOn(api.docs.ai, 'complete')
      .mockRejectedValueOnce(
        new ApiError(403, 'forbidden', 'excluded', { details: { reason: 'excluded' } }),
      );
    const ai = hook().result.current!;
    const signal = new AbortController().signal;
    await expect(ai.complete!({ before: 'a', after: '' }, signal)).rejects.toThrow();
    expect(await ai.complete!({ before: 'a', after: '' }, signal)).toBeNull();
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('says each refusal in plain words', () => {
    const refusal = (reason: string) =>
      describeAiError(new ApiError(403, 'forbidden', 'x', { details: { reason } }));
    expect(refusal('budget_reached')).toMatch(/budget is spent/);
    expect(refusal('excluded')).toMatch(/excluded from AI/);
    expect(refusal('ai_off')).toMatch(/turned off/);
  });
});
