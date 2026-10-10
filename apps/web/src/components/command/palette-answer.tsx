import { describeSources, readAnswer } from '@bemmoly/shared';
import { AiNotUseful, CommandAiNotice } from '@bemmoly/ui';
import type { AiAnswerState } from '../../hooks/use-ai-answer.ts';

/*
 * A ⌘K question's answer: the sentences as they stream, each claim with its numbered sources,
 * uncited claims marked, and where it came from. Stands in until the shared AiAnswer card.
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
  const offered = new Set(answer.sources.map((source) => source.id));
  const number = new Map(answer.sources.map((source, index) => [source.id, index + 1]));
  const blocks = readAnswer(answer.text, offered);
  if (answer.outcome === 'no_sources') {
    return (
      <CommandAiNotice title="Nothing in your docs or issues answers that">
        Try other words, or search for the page or issue by name.
      </CommandAiNotice>
    );
  }
  const from = answer.streaming ? '' : describeSources(answer.sources, answer.cited);
  return (
    <CommandAiNotice title={from ? `Answer from ${from}` : 'Answer'}>
      <div
        aria-live="polite"
        aria-busy={answer.streaming || undefined}
        className="flex flex-col gap-2"
      >
        {blocks.map((block, b) => (
          <p key={b} className={block.kind === 'item' ? 'm-0 pl-3' : 'm-0'}>
            {block.kind === 'item' && <span aria-hidden>• </span>}
            {block.sentences.map((sentence, s) => (
              <span key={s}>
                {sentence.text}
                {sentence.citations.map((id) => {
                  const source = answer.sources.find((each) => each.id === id);
                  return source ? (
                    <button
                      key={id}
                      type="button"
                      title={`${source.title} › ${source.location.label}`}
                      onClick={() => onOpen(source.href)}
                      className="mx-0.5 cursor-pointer border-0 bg-transparent p-0 align-super text-11 font-semibold text-ai-600 hover:underline"
                    >
                      {number.get(id)}
                    </button>
                  ) : null;
                })}
                {sentence.unsourced && !answer.streaming && (
                  <span className="ml-1 text-11 font-medium text-tx-3">Unsourced</span>
                )}{' '}
              </span>
            ))}
          </p>
        ))}
        {!answer.streaming && answer.runId && (
          <div>
            <AiNotUseful onClick={onNotUseful} />
          </div>
        )}
      </div>
    </CommandAiNotice>
  );
}
