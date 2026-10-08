import { Fragment } from 'react';
import { Button } from '../button/button.tsx';

export interface UnsavedSection {
  /** The section's id, so its name links to it. */
  id: string;
  title: string;
}

export interface UnsavedChangesBarProps {
  /** Sections with changes that are not saved yet. */
  sections: readonly UnsavedSection[];
  /** The person tried to leave the page with these changes open. */
  leaving?: boolean;
  onDiscardAll: () => void;
  /** Leaving: stay on the page and keep the changes. */
  onStay?: () => void;
  /** Leaving: drop the changes and go where they were heading. */
  onLeave?: () => void;
}

function names(sections: readonly UnsavedSection[]) {
  return sections.map((section, index) => (
    <Fragment key={section.id}>
      {index > 0 ? (index === sections.length - 1 ? ' and ' : ', ') : null}
      <a
        href={`#${section.id}`}
        className="font-medium text-ac hover:text-ac-d"
        onClick={(event) => {
          // Scrolls in place: a hash change would count as leaving the page for a router.
          event.preventDefault();
          document.getElementById(section.id)?.scrollIntoView({ block: 'start' });
        }}
      >
        {section.title}
      </a>
    </Fragment>
  ));
}

/**
 * Sticks to the bottom of the settings page while more than one section has unsaved changes,
 * or when the person tries to leave with any, so nothing is lost or kept by accident.
 */
export function UnsavedChangesBar({
  sections,
  leaving = false,
  onDiscardAll,
  onStay,
  onLeave,
}: UnsavedChangesBarProps) {
  if (sections.length === 0) return null;
  return (
    <div
      role={leaving ? 'alert' : 'status'}
      aria-label="Unsaved changes"
      className="sticky bottom-4 z-20 flex items-center gap-3 rounded-card border border-caution bg-sf px-4 py-3 text-13 shadow-pop"
    >
      <span aria-hidden="true" className="size-1.75 shrink-0 rounded-full bg-caution" />
      <p className="m-0 min-w-0 flex-1 leading-body text-tx-body">
        {leaving ? 'Leave without saving? ' : 'Unsaved changes in '}
        {leaving ? <>Changes in {names(sections)} are not saved.</> : <>{names(sections)}.</>}{' '}
        <span className="text-tx4">Save or cancel each section.</span>
      </p>
      {leaving ? (
        <>
          <Button variant="danger" onClick={onLeave}>
            Discard and leave
          </Button>
          <Button variant="primary" onClick={onStay}>
            Keep editing
          </Button>
        </>
      ) : (
        <Button onClick={onDiscardAll}>Discard all</Button>
      )}
    </div>
  );
}
