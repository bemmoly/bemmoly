import { citedIds, describeSources, readAnswer, type AiAnswerSource } from '@bemmoly/shared';
import { AiActionButton, AiAnswer, AiNotUseful, Button, Kbd, SkeletonText } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { AskFailure, AskState } from '../hooks/use-ask-docs.ts';

const toItem = (source: AiAnswerSource) => ({
  id: source.id,
  title: source.title,
  label: source.location.label,
  href: source.href,
  icon: source.kind === 'work.issue' ? ('subtasks' as const) : ('doc' as const),
});

function failureCopy(failure: AskFailure, isAdmin: boolean): { title: string; body: string } {
  const where = isAdmin ? ' You can change that in Settings › AI.' : ' An admin can change that.';
  switch (failure.kind) {
    case 'provider':
      return {
        title: `${failure.provider ?? 'The AI provider'} isn’t answering right now`,
        body:
          failure.retryAfterSeconds !== null
            ? `Try again in ${failure.retryAfterSeconds} seconds. Your docs are fine.`
            : 'Try again in a moment. Your docs are fine.',
      };
    case 'budget':
      return {
        title: 'This month’s AI budget is spent',
        body: `Answers are paused until next month.${where}`,
      };
    case 'unavailable':
      return {
        title: 'Answers aren’t set up yet',
        body: `Asking your docs needs an embedding model and a standard model.${where}`,
      };
    default:
      return { title: 'Couldn’t get an answer', body: 'Nothing was lost. Try again.' };
  }
}

export interface AskDocsResultProps {
  state: Exclude<AskState, { phase: 'idle' }>;
  isAdmin: boolean;
  notUseful: boolean;
  onRetry: () => void;
  onNotUseful: () => void;
}

/** Everything under the question: thinking, the streaming answer, empty and failure states. */
export function AskDocsResult({
  state,
  isAdmin,
  notUseful,
  onRetry,
  onNotUseful,
}: AskDocsResultProps) {
  if (state.phase === 'thinking') {
    return (
      <div role="status" className="flex flex-col gap-2 pt-1">
        <span className="text-13 text-tx-3">Reading your pages and issues</span>
        <SkeletonText lines={3} />
      </div>
    );
  }
  if (state.phase === 'empty') {
    return (
      <p role="status" className="m-0 text-13 text-tx-2">
        Nothing in your docs answers that yet. Try other words, or search pages by name with{' '}
        <Kbd keys="Mod+K" />.
      </p>
    );
  }
  if (state.phase === 'failed') {
    const copy = failureCopy(state.failure, isAdmin);
    const retry = state.failure.kind === 'provider' || state.failure.kind === 'other';
    return (
      <div role="alert" className="flex items-start gap-2.5 pt-1 text-13">
        <Icon name="warning" size={15} className="mt-0.5 shrink-0 text-tx-3" />
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="font-medium text-tx">{copy.title}</span>
          <span className="text-tx-2">{copy.body}</span>
          {retry && (
            <span>
              <Button size="sm" variant="secondary" onClick={onRetry}>
                Try again
              </Button>
            </span>
          )}
        </div>
      </div>
    );
  }
  const offered = new Set(state.sources.map((source) => source.id));
  const streaming = state.phase === 'streaming';
  const cited = citedIds(state.text, offered);
  return (
    <AiAnswer
      streaming={streaming}
      blocks={readAnswer(state.text, offered)}
      sources={state.sources.map(toItem)}
      source={
        !streaming && cited.length > 0 ? `from ${describeSources(state.sources, cited)}` : null
      }
      actions={
        state.phase === 'answered' ? (
          <>
            <AiActionButton onClick={onRetry}>Ask again</AiActionButton>
            {state.runId &&
              (notUseful ? (
                <span role="status" className="px-2.25 py-1 text-13 text-tx-3">
                  Thanks. Noted as not useful.
                </span>
              ) : (
                <AiNotUseful onClick={onNotUseful} />
              ))}
          </>
        ) : null
      }
    />
  );
}
