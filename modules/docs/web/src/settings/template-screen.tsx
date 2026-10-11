import { typingInField, useHeaderTrail } from '@bemmoly/core-web';
import type { OrgTemplate, TemplateDetail } from '@bemmoly/module-docs/shared';
import {
  Badge,
  Button,
  EmptyState,
  PageTitle,
  SettingsSection,
  Skeleton,
  SkeletonText,
  useToast,
} from '@bemmoly/ui';
import { Icon, PageIcon } from '@bemmoly/ui/icons';
import { useEffect, useState } from 'react';
import { TemplateEdit } from './template-edit.tsx';
import { TemplateRead } from './template-read.tsx';
import type { TemplateActions } from './templates-table.tsx';
import { useTemplate } from './use-org-templates.ts';
import { useTemplateForm, type TemplateDraft } from './use-template-form.ts';

export const SETTINGS_PATH = '/settings/docs';

export interface TemplateNavigation {
  toList: () => void;
  toTemplate: (id: string, edit?: boolean) => void;
}

/** A draft Cancel set aside, so the toast's Undo can bring it back. */
let parked: { id: string; draft: TemplateDraft } | null = null;

/** Esc outside a field, a dialog or a menu: the read view goes to the list, the editor cancels. */
function useEscape(run: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || typingInField(event.target)) return;
      if (document.querySelector('dialog[open], [role="menu"], [role="listbox"], [role="dialog"]'))
        return;
      event.preventDefault();
      run();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [run]);
}

function TemplateBody({
  id,
  template,
  row,
  editing,
  actions,
  nav,
}: {
  id: string;
  template: TemplateDetail | null;
  row: OrgTemplate | undefined;
  editing: boolean;
  actions: TemplateActions;
  nav: TemplateNavigation;
}) {
  const toast = useToast();
  const [restored] = useState(() => (parked?.id === id && editing ? parked.draft : undefined));
  useEffect(() => {
    if (restored) parked = null;
  }, [restored]);
  const form = useTemplateForm(template, (saved) => nav.toTemplate(saved.id), restored);
  const name = (editing ? form.draft.name : template?.name)?.trim() || 'New template';
  useHeaderTrail([
    { label: 'Docs', path: SETTINGS_PATH },
    { label: name, path: `${SETTINGS_PATH}?template=${id}` },
  ]);
  const cancel = () => {
    if (form.dirty) {
      parked = { id, draft: form.draft };
      toast.undo({ title: 'Changes discarded', onUndo: () => nav.toTemplate(id, true) });
    }
    if (template) nav.toTemplate(id);
    else nav.toList();
  };
  useEscape(editing ? cancel : nav.toList);
  const archived = Boolean(row?.archivedAt);
  const locked = template?.isBuiltin
    ? 'Built-in templates read only. Duplicate it to edit a copy.'
    : archived
      ? 'Restore it to edit it.'
      : undefined;
  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        variant="settings"
        title={
          <span className="flex min-w-0 items-center gap-2.5">
            <PageIcon value={(editing ? form.draft.icon : template?.icon) ?? null} size={18} />
            <span className="truncate">{name}</span>
            {template?.isBuiltin && <Badge tone="neutral">Built-in</Badge>}
            {archived && <Badge tone="outline">Archived</Badge>}
          </span>
        }
        description={
          (editing ? form.draft.description : template?.description) ||
          'A template every space can start pages from.'
        }
      />
      <SettingsSection
        title="Template"
        mode={editing ? 'edit' : 'read'}
        onEdit={() => nav.toTemplate(id, true)}
        onSave={form.submit}
        onCancel={cancel}
        dirty={form.dirty || !template}
        saving={form.saving}
        {...(locked ? { locked } : {})}
        actions={
          !editing && row ? (
            <>
              {!archived && (
                <Button
                  size="xs"
                  icon={<Icon name="copy" />}
                  onClick={() => actions.duplicate(row)}
                >
                  {row.isBuiltin ? 'Duplicate to edit' : 'Duplicate'}
                </Button>
              )}
              <Button
                size="xs"
                icon={<Icon name={archived ? 'restore' : 'archive'} />}
                onClick={() => actions.setArchived(row, !archived)}
              >
                {archived ? 'Restore' : 'Archive'}
              </Button>
            </>
          ) : null
        }
      >
        {editing ? (
          <TemplateEdit form={form} autoFocus={!template} />
        ) : (
          template && <TemplateRead template={template} row={row} />
        )}
      </SettingsSection>
    </div>
  );
}

/**
 * One org template in the settings column: its read view (`?template=<id>`) with Edit,
 * Duplicate and Archive, or its editor (`&edit=1`, or `?template=new` for a new one).
 */
export function TemplateScreen({
  id,
  editing,
  row,
  actions,
  nav,
}: {
  id: string;
  editing: boolean;
  row: OrgTemplate | undefined;
  actions: TemplateActions;
  nav: TemplateNavigation;
}) {
  const isNew = id === 'new';
  const query = useTemplate(isNew ? null : id);
  if (isNew) {
    return (
      <TemplateBody id={id} template={null} row={undefined} editing actions={actions} nav={nav} />
    );
  }
  if (query.isError) {
    return (
      <EmptyState
        headingLevel={1}
        icon={<Icon name="warning" />}
        title="This template could not be opened"
        description={`${query.error.message} It may have been removed. Go back to the list, or try again.`}
        action={
          <span className="flex gap-2">
            <Button onClick={nav.toList}>Back to templates</Button>
            <Button variant="primary" onClick={() => void query.refetch()}>
              Try again
            </Button>
          </span>
        }
      />
    );
  }
  if (!query.data) {
    return (
      <div aria-busy="true" aria-label="Loading the template" className="flex flex-col gap-6">
        <Skeleton width={220} height={22} />
        <SkeletonText lines={8} />
      </div>
    );
  }
  return (
    <TemplateBody
      key={`${id}:${String(editing)}`}
      id={id}
      template={query.data}
      row={row}
      editing={editing && !query.data.isBuiltin}
      actions={actions}
      nav={nav}
    />
  );
}
