import { ApiError, queryKeys } from '@bemmoly/api-client';
import { usePreference } from '@bemmoly/core-web';
import type { AiHandler, AiWriteEvent, AiWriteRequest } from '@bemmoly/editor';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useRef } from 'react';
import type { AiWriteStreamEvent, DocsAiCommand } from '../../../../../shared/index.ts';
import { useSpace } from '../../../hooks/queries.ts';
import { api } from '../../../shared/api.ts';
import { useSession } from '../../../shared/people.ts';
import { describeAiError, isAiRefusal } from './describe-ai-error.ts';

/*
 * What the Docs page lends its editor for AI: the /ai commands and Ask AI streaming from
 * the server into the suggestion card, ghost text from the fast role, and "Not useful".
 * Nothing at all with AI off, for a reader, in a space excluded from AI, or for a person who
 * turned AI off for themselves: the editor then draws no AI group, no Ask AI and no ghost.
 */

/** The person's own ghost text switch, kept per person on this device. */
export const GHOST_TEXT_PREFERENCE = 'docs.ghost-text';

export function useGhostTextPreference() {
  return usePreference<boolean>(GHOST_TEXT_PREFERENCE, true);
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
  const { aiEnabled } = useSession();
  const space = useSpace(aiEnabled ? spaceKey : undefined);
  const status = useQuery({
    queryKey: queryKeys.ai.status(),
    queryFn: () => api.ai.status(),
    enabled: aiEnabled,
    staleTime: 60_000,
  });
  const [ghostOn] = useGhostTextPreference();
  /* A refusal (excluded, budget spent) stops ghost text asking again on every pause. */
  const ghostRefused = useRef(false);
  const on =
    aiEnabled &&
    editable &&
    space.data?.aiExcluded === false &&
    status.data?.enabled !== false &&
    status.data?.optedOut !== true;

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
      notUseful: (runId) => void api.ai.answers.feedback(runId, 'not_useful').catch(() => null),
    };
  }, [on, pageId, ghostOn]);
}
