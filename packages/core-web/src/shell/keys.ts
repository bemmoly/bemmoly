import { useEffect, useLayoutEffect, useRef } from 'react';

/** True while the person is typing: a shortcut letter must reach the field, not the shell. */
export function typingInField(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element || typeof element.closest !== 'function') return false;
  if (element.isContentEditable || element.closest('[contenteditable="true"]')) return true;
  if (['TEXTAREA', 'SELECT'].includes(element.tagName)) return true;
  if (element.tagName !== 'INPUT') return false;
  const type = (element as HTMLInputElement).type;
  return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color'].includes(type);
}

/** A modal dialog or open menu owns the keyboard; the shell's single keys wait. */
function overlayOpen(): boolean {
  return Boolean(document.querySelector('dialog[open], [role="menu"]'));
}

/**
 * Keys by name: "mod+k" (⌘ on Apple, Ctrl elsewhere), a single key ("c", "[", "?"), or a
 * two-key chord ("g b": G, then B within a second).
 */
export type KeyBindings = Readonly<Record<string, () => void>>;

const CHORD_MS = 1000;

function nameOf(event: KeyboardEvent): string {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  return event.metaKey || event.ctrlKey ? `mod+${key}` : key;
}

/**
 * The shell's global keys. Modified keys (⌘K) work everywhere; single keys and chords never
 * fire while typing in a field, inside an open dialog or menu, or with Alt held.
 */
export function useGlobalKeys(bindings: KeyBindings): void {
  const latest = useRef(bindings);
  useLayoutEffect(() => {
    latest.current = bindings;
  });
  useEffect(() => {
    let pending: { key: string; at: number } | null = null;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.altKey) return;
      const name = nameOf(event);
      const map = latest.current;
      if (name.startsWith('mod+')) {
        const run = map[name];
        if (run) {
          event.preventDefault();
          run();
        }
        return;
      }
      if (typingInField(event.target) || overlayOpen()) {
        pending = null;
        return;
      }
      const now = performance.now();
      if (pending && now - pending.at < CHORD_MS) {
        const run = map[`${pending.key} ${name}`];
        pending = null;
        if (run) {
          event.preventDefault();
          run();
          return;
        }
      }
      if (Object.keys(map).some((binding) => binding.startsWith(`${name} `))) {
        pending = { key: name, at: now };
        return;
      }
      const run = map[name];
      if (run) {
        event.preventDefault();
        run();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
}
