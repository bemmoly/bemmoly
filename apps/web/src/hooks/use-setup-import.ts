import { useSetupStore, type ImportSourceId } from '../store/setup.ts';

export interface ImportSource {
  id: ImportSourceId;
  initials: string;
  name: string;
  description: string;
  /** Shown but not selectable until its importer ships. */
  comingSoon: boolean;
}

/** The four cards of the mock's import step, in its order and words. */
export const IMPORT_SOURCES: readonly ImportSource[] = [
  {
    id: 'jira',
    initials: 'JC',
    name: 'Jira Cloud or Server',
    description: 'Projects, issues, sprints, boards, workflows, custom fields, attachments.',
    comingSoon: true,
  },
  {
    id: 'confluence',
    initials: 'CF',
    name: 'Confluence',
    description:
      'Spaces, page trees, versions, comments, attachments. Jira macros become live issue links.',
    comingSoon: true,
  },
  {
    id: 'csv',
    initials: 'CSV',
    name: 'CSV or Linear / Trello / Asana export',
    description: 'Map columns to fields. Good for lighter tools.',
    comingSoon: true,
  },
  {
    id: 'clean',
    initials: '—',
    name: 'Start clean',
    description: 'Begin with an empty workspace and add projects when you are ready.',
    comingSoon: false,
  },
];

export const IMPORT_NOTICE =
  'Importers arrive in a later release, and you can run them later from Settings. Start clean for now.';

/** The primary button while Start clean is the only card that can be picked. */
export const START_CLEAN_LABEL = 'Continue';

/** The Done step's import line. */
export function importSummary(source: ImportSourceId | null): string {
  if (!source) return 'Skipped';
  if (source === 'clean') return 'Start clean';
  const name = IMPORT_SOURCES.find((entry) => entry.id === source)?.name ?? source;
  return `${name} (importers arrive in a later release)`;
}

/**
 * Import: the importers are coming soon, so Start clean is the one choice and is picked from
 * the start. Continue records it; Skip for now leaves the step unanswered.
 */
export function useSetupImport(next: () => void) {
  const update = useSetupStore((state) => state.update);
  return {
    sources: IMPORT_SOURCES,
    selected: 'clean' as ImportSourceId,
    notice: IMPORT_NOTICE,
    label: START_CLEAN_LABEL,
    canStart: true,
    select: (id: ImportSourceId) => update({ importSource: id }),
    start: () => {
      update({ importSource: 'clean' });
      next();
    },
  };
}
