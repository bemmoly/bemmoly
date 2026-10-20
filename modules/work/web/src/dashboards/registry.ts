import {
  WIDGET_CONFIGS,
  type PinnedReportSpec,
  type WidgetConfig,
  type WidgetSize,
  type WidgetType,
} from '@bemmoly/module-work/shared';
import type { ComponentType, ReactNode } from 'react';

/*
 * The web half of the widget registry (the other half is WIDGET_CONFIGS in shared): each
 * widget type's renderer, and for pinned reports one renderer per spec kind. A new report
 * type registers here once and every dashboard can hold it.
 */

/** One widget of the given type or types, its config narrowed to that type's. */
export type WidgetOf<T extends WidgetType> = T extends WidgetType
  ? { id: string; type: T; size: WidgetSize; config: WidgetConfig<T> }
  : never;

export interface WidgetProps<T extends WidgetType = WidgetType> {
  projectKey: string;
  widget: WidgetOf<T>;
  /** The tile's controls (drag, menu), drawn on the right of the card header. */
  actions: ReactNode;
}

export interface WidgetDefinition<T extends WidgetType = WidgetType> {
  type: T;
  /** One line in the Add report menu saying what it shows. */
  description: string;
  Component: ComponentType<WidgetProps<T>>;
  /** Offered in the Add report menu; pinned reports arrive from elsewhere instead. */
  addable: boolean;
}

const widgets = new Map<WidgetType, WidgetDefinition>();

export function registerWidget<T extends WidgetType>(definition: WidgetDefinition<T>): void {
  widgets.set(definition.type, definition as unknown as WidgetDefinition);
}

export const widgetDefinition = (type: WidgetType) => widgets.get(type);

export const widgetLabel = (type: WidgetType) => WIDGET_CONFIGS[type].label;

/** The types a person can add from the menu, in registry order. */
export const addableWidgets = () => [...widgets.values()].filter((item) => item.addable);

export interface PinnedReportProps {
  projectKey: string;
  spec: PinnedReportSpec;
}

const pinned = new Map<string, ComponentType<PinnedReportProps>>();

/** Draws pinned reports of one spec kind, e.g. "chart.bar" from the assistant. */
export function registerPinnedRenderer(
  kind: string,
  Component: ComponentType<PinnedReportProps>,
): void {
  pinned.set(kind, Component);
}

export const pinnedRenderer = (kind: string) => pinned.get(kind);
