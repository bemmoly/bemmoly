import type { AiPlanContext } from '@bemmoly/shared';
import { useRouterState } from '@tanstack/react-router';
import { useState, type KeyboardEvent } from 'react';
import { useAiAnswer } from './use-ai-answer.ts';
import { useAiPlan } from './use-ai-plan.ts';

/** The Command mock's rule: a sentence that starts with a verb is a request, not a search. */
const REQUEST =
  /^(move|assign|close|set|change|reopen|add|remove|rename|give|put|mark|comment|create|post|label|finish|publish|archive|unassign)\b/i;
/** A question: it ends with "?", or starts the way questions do. */
const QUESTION =
  /\?\s*$|^(what|who|whom|why|how|when|where|which|is|are|was|were|does|do|did|can|could|should|summari[sz]e|explain|tell me)\b/i;

export type AiIntent = 'plan' | 'ask';

/** What Bemmoly would do with the typed words, or null when they read as a search. */
export function aiIntentOf(text: string): AiIntent | null {
  const words = text.trim();
  if (words.length < 3) return null;
  if (REQUEST.test(words)) return 'plan';
  if (QUESTION.test(words)) return 'ask';
  return null;
}

const ISSUE_IN_PATH = /\/issue\/([A-Z][A-Z0-9]{1,9}-\d+)/;

/** Where the palette was opened, so "this issue" means the one behind it. */
function contextOf(pathname: string, search: Record<string, unknown>): AiPlanContext {
  const fromSearch = typeof search['issue'] === 'string' ? search['issue'] : undefined;
  const recordKey = fromSearch ?? ISSUE_IN_PATH.exec(pathname)?.[1];
  return { path: pathname.slice(0, 500), ...(recordKey ? { recordKey } : {}) };
}

export interface PaletteAiOptions {
  enabled: boolean;
  query: string;
  /** The person's first name, for "via Bemmoly for Rohan". */
  you: string;
  isAdmin: boolean;
  /** Closes the palette and opens a place (an answer's source). */
  open: (href: string) => void;
}

/**
 * The palette's AI: the AI line's wording and place, handing the words to a plan or an
 * answer, and the keys (Enter runs a ready plan, Mod+Enter asks or runs from anywhere).
 */
export function usePaletteAi({ enabled, query, you, isAdmin, open }: PaletteAiOptions) {
  const plan = useAiPlan();
  const answer = useAiAnswer();
  const location = useRouterState({ select: (state) => state.location });
  const [mode, setMode] = useState<'idle' | 'plan' | 'answer'>('idle');
  const [asked, setAsked] = useState('');
  const words = query.trim();
  const intent = aiIntentOf(words);
  const running = plan.plan ? ['approved', 'running'].includes(plan.plan.status) : false;
  // Editing the words goes back to the results; a running plan stays in view.
  const active = enabled && mode !== 'idle' && (asked === words || running);
  const ready = active && mode === 'plan' && plan.plan?.status === 'proposed' && plan.plan.runnable;

  const start = (text = words) => {
    if (!enabled || !text) return;
    setAsked(text);
    if ((aiIntentOf(text) ?? 'ask') === 'plan') {
      answer.reset();
      setMode('plan');
      plan.start(text, contextOf(location.pathname, location.search as Record<string, unknown>));
    } else {
      plan.reset();
      setMode('answer');
      answer.ask(text);
    }
  };

  const dismiss = () => {
    plan.reset();
    answer.reset();
    setMode('idle');
  };

  return {
    enabled,
    mode: active ? mode : ('idle' as const),
    active,
    plan,
    answer: answer.answer,
    you,
    isAdmin,
    open,
    /** The AI line: drawn when AI is on and something is typed; first when the words ask. */
    line:
      enabled && words && !active
        ? { label: intent === 'plan' ? 'Plan with Bemmoly' : 'Ask Bemmoly', first: intent !== null }
        : null,
    start: () => start(),
    retry: () => start(asked),
    dismiss,
    answerNotUseful: answer.notUseful,
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      if (!enabled || event.key !== 'Enter') return;
      const mod = event.metaKey || event.ctrlKey;
      if (ready && !plan.editing) {
        event.preventDefault();
        event.stopPropagation();
        plan.run();
      } else if (mod && words) {
        event.preventDefault();
        event.stopPropagation();
        if (ready) plan.run();
        else start();
      }
    },
  };
}

export type PaletteAi = ReturnType<typeof usePaletteAi>;
