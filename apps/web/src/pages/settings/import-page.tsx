import { buttonClassName, EmptyState } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { Link } from '@tanstack/react-router';
import { ImportFlowBody } from '../../components/import/import-flow-body.tsx';
import { ImportSkeleton } from '../../components/import/import-skeleton.tsx';
import { ImportStepper } from '../../components/import/import-stepper.tsx';
import { nounsOf } from '../../components/import/import-words.ts';
import { RecentImports } from '../../components/import/recent-imports.tsx';
import { cardOf, SourcePicker } from '../../components/import/source-picker.tsx';
import { SettingsPage } from '../../components/settings/settings-page.tsx';
import { STEP_INDEX, useImportFlow, type ImportFlow } from '../../hooks/use-import-flow.ts';
import { useImportJobs } from '../../hooks/use-imports.ts';

export const NO_SOURCES =
  'Turn on Work to import from Jira or a CSV file, or Docs to import from Confluence.';

export const IMPORT_INTRO =
  'Bring projects, issues, spaces and pages in from another tool. Running an import again updates what it made, so nothing is copied twice.';

/** The page's head: the source once one is picked, and what Connect does while connecting. */
function headOf(flow: ImportFlow) {
  const { source, step } = flow;
  if (!source || step === 'source') return { title: 'Import', description: IMPORT_INTRO };
  const title = `Import from ${source.label}`;
  if (step !== 'connect') return { title };
  const description =
    source.id === 'csv'
      ? 'Choose a CSV file. Nothing is brought in until you choose what to bring.'
      : `Connect with an API token. Nothing is read beyond the list of ${nounsOf(source).containers} until you choose what to bring.`;
  return { title, description };
}

export function ImportPage() {
  const flow = useImportFlow();
  const jobs = useImportJobs(flow.job);
  const items = flow.items;
  const head = headOf(flow);
  return (
    <SettingsPage
      title={head.title}
      description={head.description}
      loading={flow.sources.isPending || jobs.isPending}
      skeleton={<ImportSkeleton />}
      error={flow.sources.error ?? jobs.error}
    >
      {items.length === 0 ? (
        <EmptyState
          icon={<Icon name="upload" size={18} />}
          title="No import sources yet"
          description={NO_SOURCES}
          headingLevel={2}
          action={
            <Link to="/settings/modules" className={buttonClassName({ variant: 'primary' })}>
              Manage modules
            </Link>
          }
        />
      ) : flow.step === 'source' ? (
        <section aria-labelledby="import-source-title" className="flex flex-col gap-3">
          <h2 id="import-source-title" className="m-0 text-14 font-semibold text-tx">
            Choose a source
          </h2>
          <SourcePicker cards={items.map(cardOf)} selected={null} onSelect={flow.pick} />
        </section>
      ) : (
        <>
          <ImportStepper
            current={STEP_INDEX[flow.step]}
            canVisit={flow.canVisit}
            onVisit={flow.visit}
          />
          <ImportFlowBody flow={flow} />
        </>
      )}
      <RecentImports jobs={jobs.items} openId={flow.job?.id ?? null} onOpen={flow.open} />
    </SettingsPage>
  );
}
