import { useSetupStore, type ImportSourceId } from '../store/setup.ts';

export interface ImportSource {
  id: ImportSourceId;
  initials: string;
  name: string;
  description: string;
}

/** The four cards of the mock's import step, in its order and words. */
export const IMPORT_SOURCES: readonly ImportSource[] = [
  {
    id: 'jira',
    initials: 'JC',
    name: 'Jira Cloud or Server',
    description: 'Projects, issues, sprints, boards, workflows, custom fields, attachments.',
  },
  {
    id: 'confluence',
    initials: 'CF',
    name: 'Confluence',
    description:
      'Spaces, page trees, versions, comments, attachments. Jira macros become live issue links.',
  },
  {
    id: 'csv',
    initials: 'CSV',
    name: 'CSV or Linear / Trello / Asana export',
    description: 'Map columns to fields. Good for lighter tools.',
  },
  {
    id: 'clean',
    initials: '—',
    name: 'Start clean',
    description: 'Begin with an empty workspace and add projects when you are ready.',
  },
];

export const IMPORT_NOTICE =
  'Importers arrive in a later release. Your pick is remembered for this setup only; use Skip for now to continue.';

/** The Done step's import line. */
export function importSummary(source: ImportSourceId | null): string {
  if (!source) return 'Skipped';
  if (source === 'clean') return 'Start clean';
  const name = IMPORT_SOURCES.find((entry) => entry.id === source)?.name ?? source;
  return `${name} (importers arrive in a later release)`;
}

/** Step 2: a selectable card, and a primary button that stays off until importers exist. */
export function useSetupImport() {
  const selected = useSetupStore((state) => state.importSource);
  const update = useSetupStore((state) => state.update);
  return {
    sources: IMPORT_SOURCES,
    selected,
    select: (id: ImportSourceId) => update({ importSource: id }),
    notice: IMPORT_NOTICE,
    canStart: false as const,
  };
}
