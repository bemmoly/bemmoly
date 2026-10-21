import type { DashboardWidget, WidgetSize } from '@bemmoly/module-work/shared';
import { IconButton, Menu, MenuItem, MenuSeparator } from '@bemmoly/ui';
import { cx } from '../settings/cx.ts';
import { Icon } from '@bemmoly/ui/icons';
import { useDragList } from '../settings/drag.ts';
import { widgetDefinition, widgetLabel } from './registry.ts';
import './widgets.tsx';

export interface DashboardGridProps {
  projectKey: string;
  widgets: readonly DashboardWidget[];
  onMove: (from: number, to: number) => void;
  onResize: (id: string, size: WidgetSize) => void;
  onRemove: (id: string) => void;
}

/** One tile's controls: the grip that drags it (arrow keys step it) and its menu. */
function TileActions({
  widget,
  index,
  count,
  handle,
  onMove,
  onResize,
  onRemove,
}: {
  widget: DashboardWidget;
  index: number;
  count: number;
  handle: ReturnType<ReturnType<typeof useDragList>['handle']>;
} & Omit<DashboardGridProps, 'projectKey' | 'widgets'>) {
  const label = widgetLabel(widget.type);
  return (
    <>
      <span
        {...handle}
        tabIndex={0}
        role="button"
        aria-label={`Move ${label}`}
        title="Drag to move, or use the arrow keys"
        className="flex cursor-grab rounded-control p-1 text-tx-3 hover:text-tx"
      >
        <Icon name="drag" size={14} />
      </span>
      <Menu
        align="end"
        trigger={(props) => (
          <IconButton {...props} label={`${label} actions`} icon="more" size="xs" />
        )}
      >
        <MenuItem onSelect={() => onResize(widget.id, widget.size === 'full' ? 'half' : 'full')}>
          {widget.size === 'full' ? 'Make half width' : 'Make full width'}
        </MenuItem>
        <MenuItem disabled={index === 0} onSelect={() => onMove(index, index - 1)}>
          Move earlier
        </MenuItem>
        <MenuItem disabled={index === count - 1} onSelect={() => onMove(index, index + 1)}>
          Move later
        </MenuItem>
        <MenuSeparator />
        <MenuItem tone="danger" onSelect={() => onRemove(widget.id)}>
          Remove from dashboard
        </MenuItem>
      </Menu>
    </>
  );
}

/**
 * The dashboard's two-column grid. Tiles move by dragging the grip onto another tile, by the
 * arrow keys on the grip, or from the tile's menu; the tile under a drag shows where it lands.
 */
export function DashboardGrid(props: DashboardGridProps) {
  const { projectKey, widgets } = props;
  const drag = useDragList({ onMove: props.onMove, axis: 'y' });
  return (
    <ol className="m-0 grid list-none gap-4 p-0 lg:grid-cols-2" aria-label="Dashboard reports">
      {widgets.map((widget, index) => {
        const definition = widgetDefinition(widget.type);
        if (!definition) return null;
        const { Component } = definition;
        return (
          <li
            key={widget.id}
            {...drag.item(index)}
            className={cx(
              'min-w-0 rounded-card transition-opacity duration-150 motion-reduce:transition-none',
              widget.size === 'full' && 'lg:col-span-2',
              drag.dragging === index && 'opacity-60',
              drag.over === index && drag.dragging !== index && 'shadow-e1h',
            )}
          >
            <Component
              projectKey={projectKey}
              widget={widget}
              actions={
                <TileActions
                  widget={widget}
                  index={index}
                  count={widgets.length}
                  handle={drag.handle(index, widgets.length)}
                  onMove={props.onMove}
                  onResize={props.onResize}
                  onRemove={props.onRemove}
                />
              }
            />
          </li>
        );
      })}
    </ol>
  );
}
