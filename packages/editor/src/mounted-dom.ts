interface MountableEditor {
  isDestroyed: boolean;
  view: { dom: HTMLElement };
}

/**
 * The editor's text box, or null while it is not mounted. A page can still hold an editor for
 * one commit after its view was torn down (the body swapped editors as the live document
 * connected), and reading `view.dom` then throws; effects that attach listeners ask here.
 */
export function mountedDom(editor: MountableEditor | null | undefined): HTMLElement | null {
  if (!editor || editor.isDestroyed) return null;
  try {
    return editor.view.dom;
  } catch {
    return null;
  }
}
