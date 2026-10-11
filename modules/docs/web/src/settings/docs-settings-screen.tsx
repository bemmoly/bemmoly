import { ApiError } from '@bemmoly/api-client';
import { HeaderActions, useScreenActions } from '@bemmoly/core-web';
import type { OrgTemplate } from '@bemmoly/module-docs/shared';
import { Button, EmptyState, PageTitle, SearchInput, SegmentedControl } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useMemo } from 'react';
import { TemplateScreen, type TemplateNavigation } from './template-screen.tsx';
import { categoryLabel, TemplatesTable, type TemplateActions } from './templates-table.tsx';
import {
  useDuplicateTemplate,
  useOrgTemplates,
  useReorderTemplates,
  useSetArchived,
} from './use-org-templates.ts';
import { setSearchParams, useSearchParam } from './url-state.ts';

type View = 'active' | 'archived';

const matches = (template: OrgTemplate, query: string) =>
  [template.name, template.description ?? '', categoryLabel(template.category)].some((text) =>
    text.toLowerCase().includes(query),
  );

const nav: TemplateNavigation = {
  toList: () => setSearchParams({ template: null, edit: null }, { push: true }),
  toTemplate: (id, edit = false) =>
    setSearchParams({ template: id, edit: edit ? '1' : null }, { push: true }),
};

function ListFailure({ error, retry }: { error: Error; retry: () => void }) {
  if (error instanceof ApiError && error.status === 403) {
    return (
      <EmptyState
        icon={<Icon name="lock" />}
        title="Only people who manage org templates can change these"
        description="Ask an org admin to change them, or to give your role Manage org templates in Roles."
      />
    );
  }
  return (
    <EmptyState
      icon={<Icon name="warning" />}
      title="The templates could not be loaded"
      description={`${error.message} Nothing was changed.`}
      action={<Button onClick={retry}>Try again</Button>}
    />
  );
}

/**
 * Settings › Docs: the org-wide templates every space's picker offers. The list (searched,
 * Active or Archived) is the page; a template opens its read view and editor in the same
 * column, by the address, so Back returns to the list where it was.
 */
export function DocsSettingsScreen() {
  const typed = useSearchParam('q') ?? '';
  const query = typed.trim().toLowerCase();
  const view: View = useSearchParam('view') === 'archived' ? 'archived' : 'active';
  const open = useSearchParam('template');
  const editing = useSearchParam('edit') === '1';
  const list = useOrgTemplates();
  const archive = useSetArchived();
  const reorder = useReorderTemplates();
  const duplicate = useDuplicateTemplate((id) => nav.toTemplate(id, true));
  const actions: TemplateActions = {
    open: (template) => nav.toTemplate(template.id),
    edit: (template) => nav.toTemplate(template.id, true),
    duplicate: (template) => duplicate.mutate(template),
    setArchived: archive.run,
    reorder: (ids) => reorder.mutate(ids),
  };
  const create = () => nav.toTemplate('new', true);
  useScreenActions([
    { id: 'docs.new-template', title: 'New template', keywords: ['template'], run: create },
  ]);

  const all = useMemo(() => list.data ?? [], [list.data]);
  const active = all.filter((template) => template.archivedAt === null);
  const archived = all.filter((template) => template.archivedAt !== null);
  const shown = (view === 'active' ? active : archived).filter((template) =>
    query ? matches(template, query) : true,
  );

  if (open) {
    return (
      <TemplateScreen
        id={open}
        editing={editing || open === 'new'}
        row={all.find((template) => template.id === open)}
        actions={actions}
        nav={nav}
      />
    );
  }

  const newButton = (
    <Button variant="primary" icon={<Icon name="plus" />} onClick={create}>
      New template
    </Button>
  );
  const empty = query ? (
    <EmptyState
      icon={<Icon name="search" />}
      title="No templates match"
      description={`Nothing in ${view === 'active' ? 'active' : 'archived'} templates matches “${query}”.`}
      action={<Button onClick={() => setSearchParams({ q: null })}>Clear search</Button>}
    />
  ) : view === 'archived' ? (
    <EmptyState
      icon={<Icon name="archive" />}
      title="Nothing archived"
      description="Archived templates leave every picker and wait here to be restored."
    />
  ) : (
    <EmptyState
      icon={<Icon name="doc" />}
      title="No org templates"
      description="Add one, or restore an archived one, to offer it in every space's template picker."
      action={newButton}
    />
  );
  const forbidden = list.error instanceof ApiError && list.error.status === 403;
  return (
    <div className="flex flex-col gap-6">
      {!forbidden && <HeaderActions>{newButton}</HeaderActions>}
      <PageTitle
        variant="settings"
        title="Org templates"
        description="Every space's template picker offers these, in this order. Spaces can add their own templates."
      />
      {list.error ? (
        <ListFailure error={list.error} retry={() => void list.refetch()} />
      ) : (
        <section aria-label="Org templates" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              aria-label="Search templates"
              placeholder="Search templates"
              value={typed}
              onChange={(event) => setSearchParams({ q: event.target.value })}
              className="min-w-0 flex-1 basis-56"
            />
            <SegmentedControl
              aria-label="Which templates"
              size="sm"
              value={view}
              onChange={(next) => setSearchParams({ view: next === 'archived' ? next : null })}
              options={[
                { value: 'active', label: `Active · ${active.length}` },
                { value: 'archived', label: `Archived · ${archived.length}` },
              ]}
            />
          </div>
          <TemplatesTable
            rows={shown}
            loading={list.isPending}
            reorderable={view === 'active' && !query && shown.length > 1}
            actions={actions}
            empty={empty}
          />
        </section>
      )}
    </div>
  );
}
