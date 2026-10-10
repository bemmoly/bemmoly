import { Avatar, avatarHue, AvatarStack, RelativeTime } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api } from '../../shared/api.ts';
import { docsKeys } from '../../shared/keys.ts';
import { usePeople } from '../../shared/people.ts';
import { ReviewersDialog } from '../header/reviewers-dialog.tsx';
import { LabelsField } from '../panel/labels-field.tsx';
import { usePageScreen } from '../screen-context.ts';
import { useSetReviewers, useUpdatePage } from '../use-page-actions.ts';
import { readingTime } from './doc-stats.ts';
import { DocPopover } from './doc-popover.tsx';
import { PROP, PropKey } from './property.tsx';
import { StatusProperty } from './status-property.tsx';

const OPTION =
  'flex h-8 w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-2 text-left font-sans text-13 text-tx hover:bg-hover focus-visible:bg-hover focus-visible:outline-0 aria-selected:font-medium';

function OwnerList({ onPick }: { onPick: (id: string | null) => void }) {
  const { page } = usePageScreen();
  const [query, setQuery] = useState('');
  const people = useQuery({
    queryKey: docsKeys.people(),
    queryFn: () => api.users.list({ limit: 100 }),
    staleTime: 5 * 60_000,
  });
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (people.data?.items ?? []).filter((user) =>
      `${user.name ?? ''} ${user.email}`.toLowerCase().includes(q),
    );
  }, [people.data, query]);
  return (
    <div className="flex w-64 flex-col gap-1">
      <input
        aria-label="Find a person"
        placeholder="Find a person…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="h-8 rounded-md border border-line bg-canvas px-2 font-sans text-13 text-tx outline-0 focus:border-acc"
      />
      <div role="listbox" aria-label="Owner" className="flex max-h-64 flex-col overflow-auto">
        {shown.map((user) => (
          <button
            key={user.id}
            type="button"
            role="option"
            aria-selected={user.id === page.ownerId}
            className={OPTION}
            onClick={() => onPick(user.id)}
          >
            <Avatar name={user.name ?? user.email} hue={avatarHue(user.id)} size={20} />
            <span className="truncate">{user.name?.trim() || user.email}</span>
          </button>
        ))}
        {page.ownerId && (
          <button
            type="button"
            role="option"
            aria-selected={false}
            className={OPTION}
            onClick={() => onPick(null)}
          >
            <Icon name="close" size={14} />
            No owner
          </button>
        )}
      </div>
    </div>
  );
}

function OwnerProperty() {
  const { page, editable } = usePageScreen();
  const update = useUpdatePage(page.id);
  const look = page.owner ? (
    <>
      <Avatar name={page.owner.name} hue={avatarHue(page.owner.id)} size={18} />
      <span>{page.owner.name}</span>
    </>
  ) : (
    <>
      <Icon name="me" size={14} className="text-tx-3" />
      <PropKey>No owner</PropKey>
    </>
  );
  if (!editable) return page.owner ? <span className={PROP}>{look}</span> : null;
  return (
    <DocPopover
      label="Owner"
      trigger={(props) => (
        <button
          {...props}
          type="button"
          aria-label={`Owner: ${page.owner?.name ?? 'nobody'}. Change owner`}
          className={PROP}
        >
          {look}
        </button>
      )}
    >
      {(close) => (
        <OwnerList
          onPick={(ownerId) => {
            update.mutate({ ownerId });
            close();
          }}
        />
      )}
    </DocPopover>
  );
}

function ReviewersProperty() {
  const { page, editable } = usePageScreen();
  const { person } = usePeople();
  const save = useSetReviewers(page.id);
  const [open, setOpen] = useState(false);
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
  return (
    <>
      <button
        type="button"
        className={PROP}
        title={names.join(', ') || undefined}
        aria-label={
          names.length ? `Reviewers: ${names.join(', ')}. Change reviewers` : 'Add reviewers'
        }
        onClick={() => setOpen(true)}
      >
        {look}
      </button>
      <ReviewersDialog
        open={open}
        spaceKey={page.spaceKey}
        initial={page.reviewers}
        exclude={page.ownerId ? [page.ownerId] : []}
        confirmLabel="Save reviewers"
        error={save.error?.message ?? null}
        pending={save.isPending}
        onClose={() => {
          save.reset();
          setOpen(false);
        }}
        onConfirm={(reviewers) => save.mutate(reviewers, { onSuccess: () => setOpen(false) })}
      />
    </>
  );
}

/**
 * The page's facts in one row under the title, as the review draws it: status, owner,
 * reviewers, labels, when it was edited and how long it takes to read. Each editable value
 * opens where it is shown; read-only pages keep the values and lose the hover.
 */
export function PropertiesRow() {
  const { page, stats } = usePageScreen();
  const { person } = usePeople();
  const editor = page.updatedBy ? person(page.updatedBy)?.name : undefined;
  const reading = readingTime(stats);
  return (
    <div
      role="group"
      aria-label="Page properties"
      className="-ml-2 flex flex-wrap items-center gap-0.5 pt-3"
    >
      <StatusProperty />
      <OwnerProperty />
      <ReviewersProperty />
      <LabelsField />
      <span className={PROP} title={editor ? `Last edited by ${editor}` : undefined}>
        <PropKey>Edited</PropKey>
        <RelativeTime iso={page.contentUpdatedAt} />
      </span>
      {reading && (
        <span className={PROP}>
          <PropKey>{reading}</PropKey>
        </span>
      )}
    </div>
  );
}
