import { avatarHue, AvatarStack } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { usePeople } from '../../shared/people.ts';
import { MAX_REVIEWERS, ReviewerList } from '../header/reviewer-list.tsx';
import { usePageScreen } from '../screen-context.ts';
import { useSetReviewers } from '../use-page-actions.ts';
import { DocPopover } from './doc-popover.tsx';
import { PROP, PropKey } from './property.tsx';

/**
 * Reviewers as a face pile; a click opens the people who may review, like the owner's
 * popover, and each tick saves at once. Read-only pages show the faces and nothing more.
 */
export function ReviewersProperty() {
  const { page, editable } = usePageScreen();
  const { person } = usePeople();
  const save = useSetReviewers(page.id);
  if (!editable && page.reviewers.length === 0) return null;
  const names = page.reviewers.map((id) => person(id)?.name ?? 'Someone');
  const look = (
    <>
      <PropKey>Reviewers</PropKey>
      {page.reviewers.length > 0 ? (
        <AvatarStack
          size={18}
          max={4}
          people={page.reviewers.map((id, index) => ({
            id,
            name: names[index] ?? 'Someone',
            hue: avatarHue(id),
          }))}
        />
      ) : (
        <Icon name="plus" size={13} className="text-tx-3" />
      )}
    </>
  );
  if (!editable) {
    return (
      <span className={PROP} title={names.join(', ')}>
        {look}
      </span>
    );
  }
  const toggle = (id: string) => {
    const now = page.reviewers;
    if (!now.includes(id) && now.length >= MAX_REVIEWERS) return;
    save.mutate(now.includes(id) ? now.filter((each) => each !== id) : [...now, id]);
  };
  return (
    <DocPopover
      label="Reviewers"
      className="w-72"
      trigger={(props) => (
        <button
          {...props}
          type="button"
          className={PROP}
          title={names.join(', ') || undefined}
          aria-label={
            names.length ? `Reviewers: ${names.join(', ')}. Change reviewers` : 'Add reviewers'
          }
        >
          {look}
        </button>
      )}
    >
      {() => (
        <div className="p-1">
          <ReviewerList
            spaceKey={page.spaceKey}
            chosen={page.reviewers}
            onToggle={toggle}
            exclude={page.ownerId ? [page.ownerId] : []}
          />
        </div>
      )}
    </DocPopover>
  );
}
