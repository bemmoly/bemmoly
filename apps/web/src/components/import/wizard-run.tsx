import { Button, ProgressBar } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { ImportFlow } from '../../hooks/use-import-flow.ts';
import { isActive } from '../../hooks/use-imports.ts';
import { FormError } from '../form.tsx';
import { nounsOf, plural } from './import-words.ts';
import { ResultAlert, type ResultTone } from './result-alert.tsx';

const REPORT = 'the report waits in Settings › Import.';

/**
 * The wizard's import after Start: it runs in the background with the defaults, so this is
 * one line and a bar; Continue (the step's own button) moves on while it runs.
 */
export function WizardRun({ flow }: { flow: ImportFlow }) {
  const { job, actions } = flow;
  if (!job) return null;
  const nouns = nounsOf(flow.source);
  const what = `${plural(job.plan?.containers.length ?? 0, nouns)} from ${job.sourceLabel}`;
  const { done, total } = job.progress;
  const pct = total > 0 ? (done / total) * 100 : 0;
  if (job.status === 'ready') {
    return (
      <div className="flex flex-col gap-3">
        <FormError error={actions.plan.error ?? actions.run.error} />
        <Button
          variant="primary"
          icon={<Icon name="import" />}
          loading={actions.plan.isPending || actions.run.isPending}
          onClick={flow.startWithDefaults}
          className="self-end"
        >
          Start import
        </Button>
      </div>
    );
  }
  const running = isActive(job.status);
  const ended: Record<string, [ResultTone, string, string]> = {
    completed: ['ok', `Imported ${what}.`, `The report waits in Settings › Import.`],
    completed_with_errors: [
      'warn',
      `Imported ${what}, with a problem.`,
      `Some stopped partway; ${REPORT}`,
    ],
    cancelled: ['warn', 'Import cancelled.', `What it brought in is kept; ${REPORT}`],
    failed: ['red', 'The import stopped.', `What it brought in is kept; ${REPORT}`],
  };
  const [tone, headline, body] = running
    ? (['ok', `Importing ${what}.`, `It keeps running while you finish setup; ${REPORT}`] as const)
    : (ended[job.status] ?? ended.failed ?? ['red', '', '']);
  return (
    <div className="flex flex-col gap-3">
      <ResultAlert tone={tone} headline={headline}>
        {body}
      </ResultAlert>
      <ProgressBar
        value={running ? pct : 100}
        size="md"
        fillClassName={running ? 'bg-prog' : 'bg-done'}
        label="Import progress"
      />
    </div>
  );
}
