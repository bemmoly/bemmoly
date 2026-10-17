import type { ImportJob, ImportSource } from '@bemmoly/shared';
import { Button, SettingsSection } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useContainerChooser } from '../../hooks/use-container-chooser.ts';
import { FormError } from '../form.tsx';
import { ChooserList } from './chooser-list.tsx';
import { ChooserRowSkeleton } from './chooser-row.tsx';
import { ChooserNotices, NothingShown, RunningTotal, TokenSeesNothing } from './chooser-states.tsx';
import { ChooserToolbar } from './chooser-toolbar.tsx';
import { count } from './import-words.ts';

interface ContainerChooserProps {
  job: ImportJob;
  source: ImportSource | null;
  /** Planning what is ticked: Continue shows progress until it answers. */
  continuing: boolean;
  error: unknown;
  /** "Continue with" by default; the wizard's short path says "Start import of". */
  continueLabel?: string;
  onContinue: () => void;
  /** Back to the connection form (Back, Change connection). */
  onBack: () => void;
}

/**
 * Choose what to bring: search, filters, select all, the virtualised rows and the running
 * total, then Continue with the ticked ones. The selection lives on the server; Continue sends
 * any tick still waiting before the plan reads it.
 */
export function ContainerChooser(props: ContainerChooserProps) {
  const { job, source } = props;
  const chooser = useContainerChooser(job, source);
  const { nouns, summary } = chooser;
  const label = source?.label ?? job.sourceLabel;
  const selected = summary?.selected ?? 0;
  const title = `Choose ${nouns.containers}`;
  const hint = `${chooser.site} · ${count(chooser.total)} ${nouns.containers} this token can see`;
  const proceed = () => void chooser.flush().then(props.onContinue);

  if (chooser.total === 0 && !chooser.loading && !chooser.q && chooser.filter === 'all') {
    return (
      <SettingsSection title={title} hint={chooser.site}>
        <TokenSeesNothing chooser={chooser} label={label} onChangeConnection={props.onBack} />
      </SettingsSection>
    );
  }
  return (
    <SettingsSection title={title} hint={hint}>
      <ChooserNotices chooser={chooser} label={label} onChangeConnection={props.onBack} />
      <ChooserToolbar chooser={chooser} />
      <div className="-mx-4 border-t border-line" aria-busy={chooser.loading || undefined}>
        {chooser.error ? (
          <div className="p-4">
            <FormError error={chooser.error} />
          </div>
        ) : chooser.loading ? (
          <div role="status" aria-label={`Loading ${nouns.containers}`}>
            {Array.from({ length: 6 }, (_, index) => (
              <ChooserRowSkeleton
                key={index}
                style={{ height: chooser.rowHeight }}
                withLead={nouns.container === 'project'}
                narrow={chooser.narrow}
              />
            ))}
          </div>
        ) : chooser.count === 0 ? (
          <NothingShown chooser={chooser} />
        ) : (
          <ChooserList chooser={chooser} label={label} withLead={nouns.container === 'project'} />
        )}
      </div>
      <div className="-mx-4 -mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line px-4 py-3">
        <RunningTotal chooser={chooser} />
        {selected > 0 ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              chooser.clear();
              // The button leaves with the selection; the list keeps focus, where Mod+Z undoes.
              chooser.focusList();
            }}
          >
            Clear
          </Button>
        ) : null}
        <span className="ms-auto flex flex-wrap items-center gap-2">
          <Button variant="ghost" icon={<Icon name="back" />} onClick={props.onBack}>
            Back
          </Button>
          <Button
            variant="primary"
            disabled={selected === 0}
            loading={props.continuing}
            onClick={proceed}
          >
            {props.continueLabel ?? 'Continue with'} {count(selected)}
          </Button>
        </span>
        {props.error ? (
          <div className="w-full">
            <FormError error={props.error} />
          </div>
        ) : null}
      </div>
    </SettingsSection>
  );
}
