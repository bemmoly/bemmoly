import type { Editor } from '@tiptap/core';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from 'react';

/*
 * A small React binding for Tiptap's framework-free Editor. The editor is made once, mounted
 * into a host element, and remounted rather than rebuilt when React replays effects, so the
 * text survives StrictMode and the editor is destroyed only when the component is gone.
 */

export function useMountedEditor(create: () => Editor, host: RefObject<HTMLElement | null>) {
  const [editor] = useState(create);
  const mounts = useRef(0);

  useEffect(() => {
    const element = host.current;
    if (!element) return undefined;
    mounts.current += 1;
    editor.mount(element);
    return () => {
      mounts.current -= 1;
      editor.unmount();
      setTimeout(() => {
        if (mounts.current === 0) editor.destroy();
      }, 0);
    };
  }, [editor, host]);

  return editor;
}

const versions = new WeakMap<Editor, number>();

/** Re-renders on every transaction, focus and blur, so tools show the current marks. */
export function useEditorState(editor: Editor): number {
  const subscribe = useCallback(
    (notify: () => void) => {
      const bump = () => {
        versions.set(editor, (versions.get(editor) ?? 0) + 1);
        notify();
      };
      editor.on('transaction', bump);
      editor.on('focus', bump);
      editor.on('blur', bump);
      return () => {
        editor.off('transaction', bump);
        editor.off('focus', bump);
        editor.off('blur', bump);
      };
    },
    [editor],
  );
  return useSyncExternalStore(subscribe, () => versions.get(editor) ?? 0);
}
