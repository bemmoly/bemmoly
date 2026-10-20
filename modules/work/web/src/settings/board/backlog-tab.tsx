import { NO_BOARD_PERMISSION } from '../../hooks/settings-access.ts';
import { EditFooter, SectionHeading } from '../section.tsx';
import { NamedQueries } from './named-queries.tsx';
import { SortRules } from './sort-rules.tsx';
import { footerProps, type BoardTabProps } from './tab-props.ts';

export interface BacklogTabProps extends BoardTabProps {
  values: Readonly<Record<string, readonly string[]>>;
}

/**
 * The Backlog tab: how the backlog orders its lists and the named filters above it, saved with
 * the board so everyone planning the project sees the same order. No mock draws it; it reuses
 * the Custom lanes card of the Swimlanes tab for both lists.
 */
export function BacklogTab(props: BacklogTabProps) {
  const { settings, mode, access } = props;
  const backlog = settings.value?.config.backlog;
  if (!backlog) return null;
  const editable = mode === 'edit' && access.configureBoard;
  const update = (patch: Partial<typeof backlog>) =>
    settings.updateConfig((current) => ({ ...current, backlog: { ...current.backlog, ...patch } }));
  return (
    <div className="flex flex-col gap-4">
      <SectionHeading
        title="Backlog"
        description={`How the backlog is ordered and filtered for everyone on ${props.scope.kind === 'org' ? 'every project that follows this default' : 'the project'}. Queries can name custom fields, such as cf.severity.`}
        mode={mode}
        locked={access.configureBoard ? undefined : NO_BOARD_PERMISSION}
        onEdit={props.onEdit}
      />
      <SortRules
        rules={backlog.sortRules}
        editable={editable}
        catalog={settings.catalog}
        values={props.values}
        onChange={(sortRules) => update({ sortRules })}
      />
      <NamedQueries
        title="Backlog filters"
        addLabel="Add backlog filter"
        noun="backlog filter"
        items={backlog.filters}
        editable={editable}
        catalog={settings.catalog}
        values={props.values}
        onChange={(filters) => update({ filters })}
        footer={
          backlog.filters.length === 0
            ? 'No backlog filters yet. Add one such as "Support" with type = "Support request".'
            : 'Chips show above the backlog in this order. Turning one on filters every sprint and the backlog.'
        }
      />
      {mode === 'edit' && <EditFooter {...footerProps(props, settings.dirty.backlog)} />}
    </div>
  );
}
