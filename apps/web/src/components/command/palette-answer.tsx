import { describeSources, readAnswer } from '@bemmoly/shared/ai-answers';
import { AiNotUseful, CommandAiNotice } from '@bemmoly/ui';
import { AiAnswer } from '@bemmoly/ui/ai-answer';
import type { MouseEvent } from 'react';
import type { AiAnswerState } from '../../hooks/use-ai-answer.ts';

/*
 * A ⌘K question's answer, drawn with the shared AiAnswer card: the sentences as they stream,
 * each claim with its numbered sources, uncited claims marked, and where it came from. A
 * citation opens its source in place, closing the palette.
 */
export function PaletteAnswer({
  answer,
  onOpen,
  onNotUseful,
}: {
  answer: AiAnswerState;
  onOpen: (href: string) => void;
  onNotUseful: () => void;
}) {
  if (answer.outcome === 'no_sources') {
    return (
      <CommandAiNotice title="Nothing in your docs or issues answers that">
        Try other words, or search for the page or issue by name.
      </CommandAiNotice>
    );
  }
  const offered = new Set(answer.sources.map((source) => source.id));
  const sources = answer.sources.map((source) => ({
    id: source.id,
    title: source.title,
    label: source.location.label,
    href: source.href,
    icon: source.kind === 'work.issue' ? ('subtasks' as const) : ('doc' as const),
  }));
  const from = answer.streaming ? '' : describeSources(answer.sources, answer.cited);
  const follow = (event: MouseEvent) => {
    const link = (event.target as HTMLElement).closest('a');
    const href = link?.getAttribute('href');
    if (!href || event.metaKey || event.ctrlKey) return;
    event.preventDefault();
    onOpen(href);
  };
  return (
    <div onClick={follow} className="border-b border-line-2">
      <AiAnswer
        variant="panel"
        blocks={readAnswer(answer.text, offered)}
        sources={sources}
        streaming={answer.streaming}
        {...(from ? { source: `from ${from}` } : {})}
        {...(!answer.streaming && answer.runId
          ? { actions: <AiNotUseful onClick={onNotUseful} /> }
          : {})}
      />
    </div>
  );
}
