import { ApiError, queryKeys } from '@bemmoly/api-client';
import type { AiHandler, AiWriteEvent, AiWriteRequest } from '@bemmoly/editor';
import type { AiStatusResponse } from '@bemmoly/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef } from 'react';
import type { AiWriteStreamEvent, DocsAiCommand } from '../../../../../shared/index.ts';
import { useAiStatus, useSpaceAi } from '../../../hooks/use-space-ai.ts';
import { api } from '../../../shared/api.ts';
import { useSession } from '../../../shared/people.ts';
import { describeAiError, isAiRefusal } from './describe-ai-error.ts';

/*
 * What the Docs page lends its editor for AI: the /ai commands and Ask AI streaming from
 * the server into the suggestion card, ghost text from the fast role, and "Not useful".
 * Nothing at all with AI off, for a reader, in a space excluded from AI, or for a person who
 * turned AI off for themselves: the editor then draws no AI group, no Ask AI and no ghost.
 */

/**
 * The person's own ghost text switch, kept on the server (PUT /ai/preferences) so it follows
 * them to every device. The switch flips at once and rolls back if the save fails.
 */
export function useGhostTextPreference(): [boolean, (on: boolean) => void] {
  const { aiEnabled } = useSession();
  const client = useQueryClient();
  const status = useAiStatus(aiEnabled);
  const mutation = useMutation({
    mutationFn: (ghostText: boolean) => api.ai.setPreferences({ ghostText }),
    onMutate: async (ghostText) => {
      await client.cancelQueries({ queryKey: queryKeys.ai.status() });
      const before = client.getQueryData<AiStatusResponse>(queryKeys.ai.status());
      if (before) client.setQueryData(queryKeys.ai.status(), { ...before, ghostText });
      return { before };
    },
    onError: (_error, _value, context) => {
      if (context?.before) client.setQueryData(queryKeys.ai.status(), context.before);
    },
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.ai.status() }),
  });
  return [status.data?.ghostText ?? true, (on) => mutation.mutate(on)];
}

function toError(event: Extract<AiWriteStreamEvent, { type: 'error' }>): ApiError {
  const status = event.code === 'provider_error' ? 502 : 500;
  return new ApiError(status, event.code as ApiError['code'], event.message, {
    details: event.details,
  });
}

async function* streamWrite(
  pageId: string,
  request: AiWriteRequest,
  signal: AbortSignal,
): AsyncIterable<AiWriteEvent> {
  const events = api.docs.ai.write(
    pageId,
    {
      command: request.commandId as DocsAiCommand,
      targetText: request.targetText,
      sectionText: request.sectionText,
      heading: request.heading,
    },
    signal,
  );
  for await (const event of events) {
    if (event.type === 'error') throw toError(event);
    yield event;
  }
}

export interface DocAiOptions {
  pageId: string;
  spaceKey: string;
  editable: boolean;
}

/** The editor's AI handler for this page, or undefined when no AI surface may show. */
export function useDocAi({ pageId, spaceKey, editable }: DocAiOptions): AiHandler | undefined {
  const allowed = useSpaceAi(spaceKey);
  const [ghostOn] = useGhostTextPreference();
  /* A refusal (excluded, budget spent) stops ghost text asking again on every pause. */
  const ghostRefused = useRef(false);
  const on = allowed && editable;

  return useMemo<AiHandler | undefined>(() => {
    if (!on) return undefined;
    return {
      write: (request, signal) => streamWrite(pageId, request, signal),
      complete: async (request, signal) => {
        if (ghostRefused.current) return null;
        try {
          return (await api.docs.ai.complete(pageId, request, signal)).text;
        } catch (error) {
          if (isAiRefusal(error)) ghostRefused.current = true;
          throw error;
        }
      },
      ghostText: ghostOn,
      describeError: describeAiError,
      // A mark for the AI settings' numbers; a failed one changes nothing the person sees.
      notUseful: (runId) => void api.ai.runs.feedback(runId, 'not_useful').catch(() => null),
    };
  }, [on, pageId, ghostOn]);
}
