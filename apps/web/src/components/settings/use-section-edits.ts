import type { SettingsSectionMode, UnsavedChangesBarProps } from '@bemmoly/ui';
import { useBlocker } from '@tanstack/react-router';
import { useState } from 'react';

export interface SectionSpec {
  title: string;
  /** The section's draft differs from what is stored. */
  dirty: boolean;
  /** Throws the draft away. */
  discard: () => void;
}

/**
 * Which settings sections are being edited, for the read-then-edit pattern. A section opens
 * with Edit and closes with Cancel (its draft discarded) or after a save. While any open
 * section has unsaved changes, leaving the page asks first; with two or more, the
 * unsaved-changes bar lists them.
 */
export function useSectionEdits<Id extends string>(sections: Record<Id, SectionSpec>) {
  const [open, setOpen] = useState<readonly Id[]>([]);
  const ids = Object.keys(sections) as Id[];
  const unsaved = ids.filter((id) => open.includes(id) && sections[id].dirty);

  const close = (id: Id) => setOpen((current) => current.filter((entry) => entry !== id));
  const cancel = (id: Id) => {
    sections[id].discard();
    close(id);
  };
  const discardAll = () => {
    for (const id of open) sections[id].discard();
    setOpen([]);
  };

  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) => unsaved.length > 0 && current.pathname !== next.pathname,
    enableBeforeUnload: () => unsaved.length > 0,
    withResolver: true,
  });
  const leaving = blocker.status === 'blocked';

  const bar: UnsavedChangesBarProps = {
    sections:
      leaving || unsaved.length > 1
        ? unsaved.map((id) => ({ id: sectionAnchor(id), title: sections[id].title }))
        : [],
    leaving,
    onDiscardAll: discardAll,
    onStay: () => blocker.reset?.(),
    onLeave: () => {
      discardAll();
      blocker.proceed?.();
    },
  };

  const mode = (id: Id): SettingsSectionMode => (open.includes(id) ? 'edit' : 'read');
  const edit = (id: Id) =>
    setOpen((current) => (current.includes(id) ? current : [...current, id]));

  return {
    mode,
    edit,
    /** The SettingsSection props that follow from the edit state. */
    section: (id: Id) => ({
      id: sectionAnchor(id),
      title: sections[id].title,
      mode: mode(id),
      dirty: sections[id].dirty,
      onEdit: () => edit(id),
      onCancel: () => cancel(id),
    }),
    /** Back to the read view after a save. */
    close,
    cancel,
    bar,
  };
}

/** The element id a section gets, so the bar can scroll to it. */
export const sectionAnchor = (id: string) => `section-${id}`;
