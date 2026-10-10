import { CommandAiNotice, CommandAiThinking, CommandPlan } from '@bemmoly/ui';
import type { PaletteAi } from '../../hooks/use-palette-ai.ts';
import { PaletteAnswer } from './palette-answer.tsx';
import { planRows, planState } from './palette-plan-steps.tsx';

/**
 * Where the palette's results go once Bemmoly is asked: thinking, the plan (ready, partly
 * denied, running, done, failed, stopped, preview only) or the answer, and the honest notices
 * when the provider is down or the budget is spent. Drawn only with AI on.
 */
export function PaletteAiPanel({ ai }: { ai: PaletteAi }) {
  const { plan, answer } = ai;
  if (ai.mode === 'answer' && answer) {
    if (answer.problem) return <Problem ai={ai} problem={answer.problem} />;
    if (answer.streaming && !answer.text)
      return <CommandAiThinking label="Reading your docs and issues" onCancel={ai.dismiss} />;
    return <PaletteAnswer answer={answer} onOpen={ai.open} onNotUseful={ai.answerNotUseful} />;
  }
  if (plan.thinking) return <CommandAiThinking onCancel={ai.dismiss} />;
  if (plan.problem) return <Problem ai={ai} problem={plan.problem} />;
  const current = plan.plan;
  if (!current) return null;
  const rows = planRows(current, ai.you);
  const state = planState(current);
  const kept = plan.kept
    ? new Set(rows.filter((row) => row.indexes.some((i) => plan.kept?.has(i))).map((row) => row.id))
    : undefined;
  const empty = current.steps.length === 0;
  return (
    <CommandPlan
      summary={current.summary ?? 'Here is what I would change.'}
      steps={rows}
      state={state}
      editing={plan.editing}
      {...(kept ? { kept } : {})}
      onToggle={(id) => {
        for (const index of rows.find((row) => row.id === id)?.indexes ?? []) plan.toggle(index);
      }}
      {...(empty ? {} : { onRun: plan.run, onEdit: plan.edit })}
      onStop={plan.stop}
      {...(current.steps.some((step) => step.undoable) ? { onUndo: plan.undo } : {})}
      {...(current.runId ? { onNotUseful: plan.notUseful } : {})}
      busy={plan.busy}
      {...(state === 'preview'
        ? {
            footnote: ai.isAdmin
              ? 'Turn AI actions on in Settings › AI to run plans.'
              : 'An admin can turn AI actions on in Settings › AI.',
          }
        : empty
          ? { footnote: 'Nothing to change.' }
          : {})}
    />
  );
}

function Problem({
  ai,
  problem,
}: {
  ai: PaletteAi;
  problem: NonNullable<PaletteAi['plan']['problem']>;
}) {
  return (
    <CommandAiNotice
      tone={problem.kind === 'refused' && problem.reason === 'actions_off' ? 'note' : 'problem'}
      title={problem.title}
      {...(problem.retry ? { action: { label: 'Try again', onClick: ai.retry } } : {})}
    >
      {problem.body}
    </CommandAiNotice>
  );
}
