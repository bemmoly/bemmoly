import type { PickerCard } from '../components/import/source-picker.tsx';
import { useSetupStore, type ImportSourceId } from '../store/setup.ts';
import { useImportFlow } from './use-import-flow.ts';

export const START_CLEAN: PickerCard = {
  id: 'clean',
  initials: '+',
  name: 'Start clean',
  description: 'Begin with an empty workspace and add projects when you are ready.',
};

/**
 * The importers as the wizard shows them before their module is on: visible, not pickable,
 * each badge naming the module it waits for.
 */
export const WAITING_SOURCES: readonly PickerCard[] = [
  {
    id: 'jira',
    initials: 'JI',
    name: 'Jira',
    description: 'Projects, issues, comments, attachments and people.',
    unavailable: 'Needs Work',
  },
  {
    id: 'confluence',
    initials: 'CF',
    name: 'Confluence',
    description: 'Spaces, page trees, pages and their comments.',
    unavailable: 'Needs Docs',
  },
  {
    id: 'csv',
    initials: 'CSV',
    name: 'CSV file',
    description: 'Issues from a spreadsheet export.',
    unavailable: 'Needs Work',
  },
];

export const IMPORT_WAITING_NOTICE =
  'Importers run once Work or Docs is turned on. Continue for now, then import from Settings › Import.';

export const IMPORT_READY_NOTICE =
  'Start import runs it in the background with the default options; change them later in Settings › Import.';

const NAMES: Record<string, string> = { jira: 'Jira', confluence: 'Confluence', csv: 'CSV file' };

/** The Done step's import line. */
export function importSummary(source: ImportSourceId | null): string {
  if (!source) return 'Skipped';
  if (source === 'clean') return 'Start clean';
  return `${NAMES[source] ?? source} (report in Settings › Import)`;
}

const isSourceId = (id: string): id is ImportSourceId =>
  ['jira', 'confluence', 'csv', 'clean'].includes(id);

/**
 * Import: the same flow as Settings › Import, plus Start clean, which is picked until another
 * card is. Sources come from the modules that are on; when none is (or the list cannot be
 * read yet), the importers show as waiting and Continue moves on.
 */
export function useSetupImport(next: () => void) {
  const update = useSetupStore((state) => state.update);
  const flow = useImportFlow();
  const offered = flow.items.length > 0;
  const selected = flow.source?.id ?? 'clean';
  const cards: PickerCard[] = [
    ...(offered
      ? flow.items.map((source) => ({
          id: source.id,
          name: source.label,
          description: source.description,
          initials: source.label.slice(0, 2).toUpperCase(),
        }))
      : WAITING_SOURCES),
    START_CLEAN,
  ];
  return {
    flow,
    cards,
    selected,
    loading: flow.sources.isPending && flow.sources.fetchStatus !== 'idle',
    notice: offered ? IMPORT_READY_NOTICE : IMPORT_WAITING_NOTICE,
    label: 'Continue',
    canStart: true,
    select: (id: string) => {
      if (id === 'clean') flow.startOver();
      else flow.pick(id);
      if (isSourceId(id)) update({ importSource: id });
    },
    start: () => {
      update({ importSource: isSourceId(selected) ? selected : 'clean' });
      next();
    },
  };
}
