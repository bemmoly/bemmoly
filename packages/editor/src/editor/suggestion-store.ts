import type { IconName } from '@bemmoly/ui/icons';
import type { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import type { SuggestionItem } from '../types.ts';

/*
 * The bridge between Tiptap's suggestion plugins (@ people, # records, / blocks) and React.
 * The plugin owns matching, debouncing, aborting and positioning; this store holds what the
 * open list shows and which row is active, and answers the keys the list takes over. One
 * store serves every trigger of an editor, since only one list is open at a time.
 */

export type SuggestionKind = 'mention' | 'reference' | 'slash';

export interface SuggestionRow extends SuggestionItem {
  /** A section heading the row sits under, such as "Basic blocks". */
  group?: string;
  /** The / menu's tile: the block's drawing. */
  icon?: IconName;
  /** The Markdown or key that does the same, drawn as a key at the row's end. */
  hint?: string;
  /** AI rows take the lilac reserved for AI. */
  tone?: 'ai';
}

export interface OpenSuggestion {
  kind: SuggestionKind;
  /** Names the list: "People", "Issues", "Blocks". */
  label: string;
  query: string;
  items: readonly SuggestionRow[];
  loading: boolean;
  failed: boolean;
  active: number;
  /** The floating element the list renders into; the plugin keeps it at the caret. */
  element: HTMLElement;
}

type Render = NonNullable<SuggestionOptions<SuggestionRow>['render']>;

/** Where a popover may live: inside the open modal dialog, or the body. */
const layerFor = (node: Element): HTMLElement => node.closest('dialog') ?? node.ownerDocument.body;

export class SuggestionStore {
  private open: OpenSuggestion | null = null;
  private command: ((item: SuggestionRow) => void) | null = null;
  private failedQuery: string | null = null;
  private readonly listeners = new Set<() => void>();

  /** Wraps a server search so a failure shows as a message in the list, not an empty one. */
  searching(search: (query: string, signal: AbortSignal) => Promise<readonly SuggestionRow[]>) {
    return async ({ query, signal }: { query: string; signal: AbortSignal }) => {
      try {
        const rows = await search(query, signal);
        this.failedQuery = null;
        return [...rows];
      } catch {
        if (!signal.aborted) this.failedQuery = query;
        return [];
      }
    };
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  get = (): OpenSuggestion | null => this.open;

  get isOpen(): boolean {
    return this.open !== null;
  }

  private set(next: OpenSuggestion | null) {
    this.open = next;
    for (const listener of this.listeners) listener();
  }

  setActive(index: number) {
    if (this.open && index !== this.open.active) this.set({ ...this.open, active: index });
  }

  choose(index: number) {
    const item = this.open?.items[index];
    if (item) this.command?.(item);
  }

  /** Arrows move, Enter and Tab choose; anything else goes on to the editor. */
  keyDown(event: KeyboardEvent): boolean {
    const open = this.open;
    if (!open) return false;
    const count = open.items.length;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (count === 0) return true;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.setActive((open.active + step + count) % count);
      return true;
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      if (count === 0) return event.key === 'Tab';
      this.choose(open.active);
      return true;
    }
    return false;
  }

  /** The render hooks for one trigger. */
  renderer(kind: SuggestionKind, label: string): Render {
    return () => {
      let unmount: (() => void) | null = null;
      const update = (props: SuggestionProps<SuggestionRow>, element: HTMLElement) => {
        this.command = props.command;
        const same = this.open?.query === props.query;
        this.set({
          kind,
          label,
          query: props.query,
          items: props.items,
          loading: props.loading,
          failed: !props.loading && this.failedQuery === props.query,
          active: same ? Math.min(this.open?.active ?? 0, Math.max(props.items.length - 1, 0)) : 0,
          element,
        });
      };
      return {
        onStart: (props) => {
          const element = document.createElement('div');
          element.className = 'z-50';
          layerFor(props.editor.view.dom).appendChild(element);
          unmount = props.mount(element);
          update(props, element);
        },
        onUpdate: (props) => {
          if (this.open) update(props, this.open.element);
        },
        onExit: () => {
          const element = this.open?.element;
          unmount?.();
          unmount = null;
          element?.remove();
          this.command = null;
          this.set(null);
        },
        onKeyDown: ({ event }) => this.keyDown(event),
      };
    };
  }
}
