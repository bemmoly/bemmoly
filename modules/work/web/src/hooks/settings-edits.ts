import type { SettingsSectionMode, UnsavedChangesBarProps } from '@bemmoly/ui';
import { useEffect, useState } from 'react';

export interface EditSpec {
  title: string;
  /** The section's draft differs from what is stored. */
  dirty: boolean;
  /** Throws the draft away. */
  discard: () => void;
}

/** The element id a section gets, so the unsaved-changes bar can scroll to it. */
export const sectionAnchor = (id: string) => `settings-${id}`;

/**
 * Which settings sections are open for editing: the kernel's read-then-edit
 * pattern for a module page. A section opens with Edit and closes with Cancel
 * (its draft discarded) or after a save. Closing the tab asks first while a
 * draft is unsaved, and `guard` holds a move to another settings page until
 * the person keeps editing or discards; with two or more drafts the bar lists
 * them.
 */
export function useSettingsEdits<Id extends string>(sections: Record<Id, EditSpec>) {
  const [open, setOpen] = useState<readonly Id[]>([]);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const ids = Object.keys(sections) as Id[];
  const unsaved = ids.filter((id) => open.includes(id) && sections[id].dirty);
  const hasUnsaved = unsaved.length > 0;

  useEffect(() => {
    if (!hasUnsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsaved]);

  const close = (id: Id) => setOpen((current) => current.filter((entry) => entry !== id));
  const cancel = (id: Id) => {
    sections[id].discard();
    close(id);
  };
  const discardAll = () => {
    for (const id of open) sections[id].discard();
    setOpen([]);
  };
  const edit = (id: Id) =>
    setOpen((current) => (current.includes(id) ? current : [...current, id]));
  const mode = (id: Id): SettingsSectionMode => (open.includes(id) ? 'edit' : 'read');

  /** Runs `go` now, or once the person chooses to discard their unsaved drafts. */
  const guard = (go: () => void) => {
    if (hasUnsaved) setPending(() => go);
    else go();
  };

  const leaving = pending !== null;
  const bar: UnsavedChangesBarProps = {
    sections:
      leaving || unsaved.length > 1
        ? unsaved.map((id) => ({ id: sectionAnchor(id), title: sections[id].title }))
        : [],
    leaving,
    onDiscardAll: discardAll,
    onStay: () => setPending(null),
    onLeave: () => {
      discardAll();
      pending?.();
      setPending(null);
    },
  };

  return { mode, edit, close, cancel, guard, bar, unsaved };
}
