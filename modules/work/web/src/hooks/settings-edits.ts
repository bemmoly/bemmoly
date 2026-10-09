import { useLeaveGuard } from '@bemmoly/core-web';
import type { SettingsSectionMode, UnsavedChangesBarProps } from '@bemmoly/ui';
import { useState } from 'react';

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
 * (its draft discarded) or after a save. While a draft is unsaved the shell's
 * leave guard holds every move away, from the settings sidebar, the top bar
 * or Back, until the person keeps editing or discards; closing the tab asks
 * too. With two or more drafts the bar lists them.
 */
export function useSettingsEdits<Id extends string>(sections: Record<Id, EditSpec>) {
  const [open, setOpen] = useState<readonly Id[]>([]);
  const ids = Object.keys(sections) as Id[];
  const unsaved = ids.filter((id) => open.includes(id) && sections[id].dirty);
  const guard = useLeaveGuard({ when: unsaved.length > 0 });

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

  const leaving = guard.blocked;
  const bar: UnsavedChangesBarProps = {
    sections:
      leaving || unsaved.length > 1
        ? unsaved.map((id) => ({ id: sectionAnchor(id), title: sections[id].title }))
        : [],
    leaving,
    onDiscardAll: discardAll,
    onStay: guard.stay,
    onLeave: () => {
      discardAll();
      guard.leave();
    },
  };

  return { mode, edit, close, cancel, bar, unsaved };
}
