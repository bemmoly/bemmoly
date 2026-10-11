import type { Editor, NodeViewRendererProps } from '@tiptap/core';
import type { Node as PmNode } from '@tiptap/pm/model';
import type { NodeView, ViewMutationRecord } from '@tiptap/pm/view';
import type { ComponentType } from 'react';

/*
 * React inside ProseMirror without a second React root per node. Each node view owns plain
 * DOM (the box, and a content hole when the node holds text) and a "chrome" element; this
 * store lists the chromes, and one React component in the editor's tree portals each node's
 * component into its chrome. Portals keep the host's context (its query client, its theme),
 * which an issue renderer from Work needs.
 */

export interface NodeViewProps {
  node: PmNode;
  editor: Editor;
  /** Where the node starts; undefined once it has left the document. */
  getPos: () => number | undefined;
  selected: boolean;
  /** Sets attributes on this node, as one undoable step. */
  updateAttributes: (attrs: Record<string, unknown>) => void;
}

export interface ViewSpec {
  /** The node's box: its tag, and its classes and attributes for the current node. */
  tag: keyof HTMLElementTagNameMap;
  className: (node: PmNode) => string;
  attrs?: (node: PmNode) => Record<string, string>;
  /** A content hole for nodes that hold blocks, with the chrome before it. */
  content?: { tag: keyof HTMLElementTagNameMap; className: string };
  /** The chrome's own tag and classes; by default a div that fills the box. */
  chrome?: { tag: keyof HTMLElementTagNameMap; className: string };
  Component: ComponentType<NodeViewProps>;
}

export interface PortalEntry {
  id: number;
  element: HTMLElement;
  props: NodeViewProps;
  Component: ComponentType<NodeViewProps>;
}

export class PortalStore {
  private entries = new Map<number, PortalEntry>();
  private snapshot: PortalEntry[] = [];
  private readonly listeners = new Set<() => void>();
  private next = 0;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };

  get = () => this.snapshot;

  allocate = () => ++this.next;

  set(entry: PortalEntry) {
    this.entries.set(entry.id, entry);
    this.emit();
  }

  remove(id: number) {
    if (this.entries.delete(id)) this.emit();
  }

  private emit() {
    this.snapshot = [...this.entries.values()];
    for (const listener of this.listeners) listener();
  }
}

const apply = (element: HTMLElement, spec: ViewSpec, node: PmNode) => {
  element.className = spec.className(node);
  for (const [name, value] of Object.entries(spec.attrs?.(node) ?? {})) {
    element.setAttribute(name, value);
  }
};

/** One node's view: its DOM, kept in step with the node, and its entry in the store. */
export class PortalNodeView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement | null = null;
  private readonly chrome: HTMLElement;
  private readonly id: number;
  private node: PmNode;
  private selected = false;
  private readonly props: NodeViewRendererProps;
  private readonly spec: ViewSpec;
  private readonly store: PortalStore;

  constructor(props: NodeViewRendererProps, spec: ViewSpec, store: PortalStore) {
    this.props = props;
    this.spec = spec;
    this.store = store;
    this.node = props.node;
    this.id = store.allocate();
    this.dom = document.createElement(spec.tag);
    apply(this.dom, spec, this.node);
    this.chrome = document.createElement(
      spec.chrome?.tag ?? (props.node.isInline ? 'span' : 'div'),
    );
    this.chrome.contentEditable = 'false';
    if (spec.chrome) this.chrome.className = spec.chrome.className;
    this.dom.appendChild(this.chrome);
    if (spec.content) {
      this.contentDOM = document.createElement(spec.content.tag);
      this.contentDOM.className = spec.content.className;
      this.dom.appendChild(this.contentDOM);
    }
    this.publish();
  }

  private publish() {
    const { editor, getPos } = this.props;
    this.store.set({
      id: this.id,
      element: this.chrome,
      Component: this.spec.Component,
      props: {
        node: this.node,
        editor,
        getPos: () => (typeof getPos === 'function' ? getPos() : undefined),
        selected: this.selected,
        updateAttributes: (attrs) => {
          const pos = typeof getPos === 'function' ? getPos() : undefined;
          if (pos === undefined) return;
          editor.view.dispatch(
            editor.state.tr.setNodeMarkup(pos, undefined, { ...this.node.attrs, ...attrs }),
          );
        },
      },
    });
  }

  update(node: PmNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    apply(this.dom, this.spec, node);
    this.publish();
    return true;
  }

  selectNode() {
    this.selected = true;
    this.dom.classList.add('ProseMirror-selectednode');
    this.publish();
  }

  deselectNode() {
    this.selected = false;
    this.dom.classList.remove('ProseMirror-selectednode');
    this.publish();
  }

  /** Clicks and keys in the chrome (a menu, an input) belong to React, not the editor. */
  stopEvent(event: Event): boolean {
    return event.target instanceof Node && this.chrome.contains(event.target);
  }

  ignoreMutation(mutation: ViewMutationRecord): boolean {
    if (mutation.type === 'selection') return false;
    if (this.contentDOM?.contains(mutation.target)) return false;
    return true;
  }

  destroy() {
    this.store.remove(this.id);
  }
}
