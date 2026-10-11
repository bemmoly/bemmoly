import { ApiError, queryKeys } from '@bemmoly/api-client';
import type { AiWriteEvent } from '@bemmoly/editor';
import type { AiStatusResponse } from '@bemmoly/shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../shared/api.ts';
import { docsKeys } from '../../../shared/keys.ts';
import { newClient, providers, space, SPACE_ID } from '../../../test-support.tsx';
import { describeAiError } from './describe-ai-error.ts';
import { useDocAi, useGhostTextPreference } from './use-doc-ai.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

const PAGE = '0199c0de-0000-7000-8000-000000000071';

interface Seed {
  aiEnabled?: boolean;
  editable?: boolean;
  excluded?: boolean;
  optedOut?: boolean;
  ghostText?: boolean;
  /** Settings › AI › Privacy excludes the space. */
  policyExcluded?: boolean;
}

const status = ({
  aiEnabled = true,
  optedOut = false,
  ghostText = true,
  policyExcluded = false,
}: Seed = {}) =>
  ({
    enabled: aiEnabled,
    optedOut,
    optOutAllowed: true,
    ghostText,
    excludedSpaceIds: policyExcluded ? [SPACE_ID] : [],
    excludedProjectIds: [],
    allowActions: true,
    availableRoles: ['fast', 'standard', 'strong'],
    budgetState: 'unlimited',
  }) satisfies AiStatusResponse;

function seeded(seed: Seed = {}) {
  const client = newClient();
  client.setQueryData(queryKeys.me(), {
    user: { id: 'u-1', name: 'Rohan' },
    workspace: { name: 'Acme', aiEnabled: seed.aiEnabled ?? true },
    capabilities: [],
    modules: ['docs'],
  });
  client.setQueryData(docsKeys.space('ENG'), space({ aiExcluded: seed.excluded ?? false }));
  client.setQueryData(queryKeys.ai.status(), status(seed));
  return client;
}

function hook(seed: Seed = {}) {
  const editable = seed.editable ?? true;
  return renderHook(() => useDocAi({ pageId: PAGE, spaceKey: 'ENG', editable }), {
    wrapper: providers(seeded(seed)),
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
    expect(hook({ policyExcluded: true }).result.current).toBeUndefined();
    expect(hook({ optedOut: true }).result.current).toBeUndefined();
    expect(hook().result.current).toBeDefined();
  });

  it('follows the person’s ghost text switch from the server', () => {
    expect(hook().result.current?.ghostText).toBe(true);
    expect(hook({ ghostText: false }).result.current?.ghostText).toBe(false);
  });

  it('saves the ghost text switch on the server, and rolls it back if that fails', async () => {
    // The server's copy: a refetch after each save reads it back.
    let saved = true;
    vi.spyOn(api.ai, 'status').mockImplementation(async () => ({
      ...status(),
      ghostText: saved,
    }));
    const save = vi.spyOn(api.ai, 'setPreferences').mockImplementation(async (body) => {
      saved = body.ghostText ?? saved;
    });
    const client = seeded();
    const { result } = renderHook(() => useGhostTextPreference(), { wrapper: providers(client) });
    expect(result.current[0]).toBe(true);
    act(() => result.current[1](false));
    await waitFor(() => expect(result.current[0]).toBe(false));
    expect(save).toHaveBeenCalledWith({ ghostText: false });
    expect(client.getQueryData<AiStatusResponse>(queryKeys.ai.status())?.ghostText).toBe(false);

    save.mockRejectedValueOnce(new ApiError(500, 'internal_error', 'down'));
    act(() => result.current[1](true));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current[0]).toBe(false));
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
