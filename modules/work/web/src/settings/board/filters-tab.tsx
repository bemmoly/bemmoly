import { NO_BOARD_PERMISSION } from '../../hooks/settings-access.ts';
import { EditFooter, SectionHeading } from '../section.tsx';
import { NamedQueries } from './named-queries.tsx';
import { footerProps, type BoardTabProps } from './tab-props.ts';

export interface FiltersTabProps extends BoardTabProps {
  values: Readonly<Record<string, readonly string[]>>;
}

/**
 * The Quick filters tab: the named LQL chips above the board. No mock draws
 * it; it reuses the Custom lanes card of the Swimlanes tab.
 */
export function FiltersTab(props: FiltersTabProps) {
  const { settings, mode, access } = props;
  const filters = settings.value?.config.quickFilters;
  if (!filters) return null;
  const editable = mode === 'edit' && access.configureBoard;
  return (
    <div className="flex flex-col gap-4">
      <SectionHeading
        title="Quick filters"
        description="One-click filters shown above the board for everyone on the project. Each is a query; members turn them on and off for themselves."
        mode={mode}
        locked={access.configureBoard ? undefined : NO_BOARD_PERMISSION}
        onEdit={props.onEdit}
      />
      <NamedQueries
        title="Quick filters"
        addLabel="Add quick filter"
        noun="quick filter"
        items={filters}
        editable={editable}
        catalog={settings.catalog}
        values={props.values}
        onChange={(quickFilters) =>
          settings.updateConfig((current) => ({ ...current, quickFilters }))
        }
        footer={
          filters.length === 0
            ? 'No quick filters yet. Add one such as "Only my issues" with assignee = me.'
            : 'Chips show in this order. Queries use the same language as Filters.'
        }
      />
      {mode === 'edit' && <EditFooter {...footerProps(props, settings.dirty.filters)} />}
    </div>
  );
}
