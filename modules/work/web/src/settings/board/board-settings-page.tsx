import {
  Button,
  EmptyState,
  PageTitle,
  SettingsContent,
  SettingsFrame,
  SegmentedControl,
  UnsavedChangesBar,
} from '@bemmoly/ui';
import { useMemo, useState, type ReactNode } from 'react';
import {
  NO_BOARD_PERMISSION,
  orgDefaultsAccess,
  useSettingsAccess,
} from '../../hooks/settings-access.ts';
import { useBoardReview } from '../../hooks/settings-board-review.ts';
import { useBoardSettings } from '../../hooks/settings-board.ts';
import { sectionAnchor, useSettingsEdits } from '../../hooks/settings-edits.ts';
import { useIssueTypes } from '../../hooks/settings-schemes.ts';
import { BOARD_SECTIONS, SECTION_TITLES, type BoardSection } from '../model/sections.ts';
import { BoardSettingsSkeleton, PreviewRailSkeleton } from '../../skeletons/settings-skeleton.tsx';
import { InheritanceNote } from '../inheritance-note.tsx';
import { OrgDefaultNote } from '../org-default-note.tsx';
import { orgSettingsPath, type SettingsScope } from '../pages.ts';
import { BoardDialogs } from './board-dialogs.tsx';
import { CardsTab } from './cards-tab.tsx';
import { ColumnsTab } from './columns-tab.tsx';
import { FiltersTab } from './filters-tab.tsx';
import { LanesTab } from './lanes-tab.tsx';
import { MethodTab } from './method-tab.tsx';
import { PreviewRail } from './preview-rail.tsx';
import type { BoardTabProps } from './tab-props.ts';

export interface BoardSettingsPageProps {
  scope: SettingsScope;
}

/**
 * Board settings, from the Board Settings mock, for one project or for the org default every
 * project follows until it changes its own. A project's page says which default it is based
 * on, with the diff; the org default's says which projects it reaches. Then one tab per part
 * of the board: each reads calmly until Edit, saves on its own after the diff is reviewed,
 * and asks before a change that takes cards off the board.
 */
export function BoardSettingsPage({ scope }: BoardSettingsPageProps) {
  const org = scope.kind === 'org';
  const settings = useBoardSettings(scope);
  const personal = useSettingsAccess();
  const access = org ? orgDefaultsAccess(personal) : personal;
  const types = useIssueTypes(org ? null : settings.project?.id);
  // The Board's Display menu links straight to a tab, e.g. ?tab=cards.
  const [tab, setTab] = useState<BoardSection>(() => {
    const asked = new URLSearchParams(window.location.search).get('tab');
    return BOARD_SECTIONS.find((section) => section === asked) ?? 'columns';
  });
  const spec = (section: BoardSection) => ({
    title: SECTION_TITLES[section],
    dirty: settings.dirty[section],
    discard: () => settings.discard(section),
  });
  const edits = useSettingsEdits({
    columns: spec('columns'),
    lanes: spec('lanes'),
    filters: spec('filters'),
    cards: spec('cards'),
    method: spec('method'),
  });
  const review = useBoardReview(settings, (section) => edits.close(section));
  const values = useMemo(
    () => ({
      statuses: settings.statuses.map((status) => status.name),
      issueTypes: (types.list.data ?? []).map((type) => type.name),
    }),
    [settings.statuses, types.list.data],
  );

  const project = settings.project;
  const schemeName = settings.orgBoard
    ? `the org default, ${settings.orgBoard.name}`
    : settings.baseName;
  const frame = (content: ReactNode, aside?: ReactNode) => (
    <SettingsFrame nav={null} aside={aside}>
      <SettingsContent width="narrow">{content}</SettingsContent>
    </SettingsFrame>
  );

  if (settings.projectMissing) {
    const key = scope.kind === 'project' ? (scope.projectKey ?? '') : '';
    return frame(
      <EmptyState title="No such project" description={`There is no project ${key}.`} />,
    );
  }
  if (settings.error) {
    return frame(
      <EmptyState title="Board settings did not load" description={settings.error.message} />,
    );
  }
  if (settings.isPending || !settings.value || (!org && !project)) {
    return frame(<BoardSettingsSkeleton />, <PreviewRailSkeleton />);
  }

  const tabProps = (section: BoardSection): BoardTabProps => ({
    scope,
    settings,
    mode: edits.mode(section),
    access,
    problems: settings.prepare(section)?.problems ?? [],
    saving: settings.save.isPending,
    error: review.saveReview.open ? null : settings.save.error,
    onEdit: () => edits.edit(section),
    onCancel: () => edits.cancel(section),
    onSave: () => review.start(section),
  });
  const content = {
    columns: <ColumnsTab {...tabProps('columns')} />,
    lanes: <LanesTab {...tabProps('lanes')} values={values} />,
    filters: <FiltersTab {...tabProps('filters')} values={values} />,
    cards: <CardsTab {...tabProps('cards')} values={values} />,
    method: <MethodTab {...tabProps('method')} />,
  }[tab];

  return frame(
    <>
      {project ? (
        <>
          <PageTitle
            variant="settings"
            title="Board"
            description={`How the board looks for everyone on ${project.name}. Filters and swimlanes people pick stay personal.`}
            actions={
              <Button
                disabled={!access.configureBoard || review.resetChanges.length === 0}
                title={access.configureBoard ? undefined : NO_BOARD_PERMISSION}
                onClick={review.startReset}
              >
                Reset to default
              </Button>
            }
          />
          <InheritanceNote
            origin={settings.baseName}
            changes={settings.overrides.length}
            onCompare={() => review.setViewing(true)}
            defaultHref={personal.orgAdmin ? orgSettingsPath('board') : undefined}
          />
        </>
      ) : (
        <>
          <PageTitle
            variant="settings"
            title="Board"
            description="The board every project starts from, and keeps following until it changes its own. Filters and swimlanes people pick stay personal."
          />
          <OrgDefaultNote kind="board" enabled={access.orgAdmin} />
        </>
      )}
      <SegmentedControl<BoardSection>
        size="sm"
        aria-label="Board settings"
        className="self-start max-sm:self-stretch max-sm:overflow-x-auto"
        options={BOARD_SECTIONS.map((section) => ({
          value: section,
          label: (
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              {org && section === 'method' ? 'Sprints and estimation' : SECTION_TITLES[section]}
              {edits.unsaved.includes(section) && (
                <span className="size-1.5 rounded-full bg-amber" title="Unsaved changes" />
              )}
            </span>
          ),
        }))}
        value={tab}
        onChange={setTab}
      />
      <section id={sectionAnchor(tab)} aria-label={SECTION_TITLES[tab]} className="scroll-mt-6">
        {content}
      </section>
      <UnsavedChangesBar {...edits.bar} />
      <BoardDialogs settings={settings} review={review} schemeName={schemeName} />
    </>,
    <PreviewRail
      draft={settings.value}
      boardHref={project ? `/work/board/${project.key}` : null}
    />,
  );
}
