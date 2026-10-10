import { formatRelative } from '@bemmoly/core-web';
import { Icon } from '@bemmoly/ui/icons';
import {
  Avatar,
  avatarHue,
  FieldList,
  FieldPerson,
  FieldRow,
  PageStatusPill,
  Select,
} from '@bemmoly/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../shared/api.ts';
import { docsKeys } from '../../shared/keys.ts';
import { usePeople } from '../../shared/people.ts';
import { shortDate } from '../body/page-heading.tsx';
import { ReviewersDialog } from '../header/reviewers-dialog.tsx';
import { usePageScreen } from '../screen-context.ts';
import { useSetReviewers, useUpdatePage } from '../use-page-actions.ts';
import { LabelsField } from './labels-field.tsx';

const LINK =
  'inline-flex cursor-pointer items-center gap-1 rounded-chip border-0 bg-transparent px-1 py-0.5 font-sans text-13 font-medium text-acc hover:text-acc-600 focus-visible:shadow-ring focus-visible:outline-0';

/** Everyone who wrote the page: its versions' authors, its creator and its last editor. */
function useContributors(pageId: string, known: readonly (string | null)[]) {
  const revisions = useQuery({
    queryKey: [...docsKeys.revisions(pageId), 'authors'],
    queryFn: () => api.docs.revisions.list(pageId, { limit: 50 }),
    staleTime: 60_000,
    retry: false,
  });
  const ids = new Set<string>();
  for (const id of known) if (id) ids.add(id);
  for (const revision of revisions.data?.items ?? []) {
    for (const id of revision.authorIds) ids.add(id);
  }
  return [...ids];
}

function OwnerField() {
  const { page, editable } = usePageScreen();
  const people = useQuery({
    queryKey: docsKeys.people(),
    queryFn: () => api.users.list({ limit: 100 }),
    staleTime: 5 * 60_000,
    enabled: editable,
  });
  const update = useUpdatePage(page.id);
  if (!editable) {
    return page.owner ? (
      <FieldPerson name={page.owner.name} hue={avatarHue(page.owner.id)} />
    ) : (
      <span className="text-tx-3">Nobody</span>
    );
  }
  const options = (people.data?.items ?? []).map((user) => ({
    value: user.id,
    label: user.name?.trim() || user.email,
    description: user.email,
    icon: <Avatar name={user.name ?? user.email} hue={avatarHue(user.id)} size={20} />,
  }));
  if (page.owner && !options.some((option) => option.value === page.owner?.id)) {
    options.unshift({
      value: page.owner.id,
      label: page.owner.name,
      description: '',
      icon: <Avatar name={page.owner.name} hue={avatarHue(page.owner.id)} size={20} />,
    });
  }
  return (
    <Select
      aria-label="Owner"
      variant="ghost"
      size="sm"
      placeholder="Nobody"
      searchable
      value={page.ownerId ?? undefined}
      options={options}
      onChange={(event) => update.mutate({ ownerId: event.value })}
    />
  );
}

function ReviewersField() {
  const { page, editable } = usePageScreen();
  const { person } = usePeople();
  const save = useSetReviewers(page.id);
  const [open, setOpen] = useState(false);
  return (
    <>
      {page.reviewers.map((id) => (
        <FieldPerson key={id} name={person(id)?.name ?? 'Someone'} hue={avatarHue(id)} />
      ))}
      {page.reviewers.length === 0 && !editable && <span className="text-tx-3">Nobody</span>}
      {editable && (
        <button type="button" className={LINK} onClick={() => setOpen(true)}>
          {page.reviewers.length ? (
            'Change'
          ) : (
            <>
              <Icon name="plus" size={14} />
              Add reviewers
            </>
          )}
        </button>
      )}
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
 * The page's facts in the Issue sidebar's field grid: status, owner, reviewers, labels, length,
 * when it was made and changed, and who wrote it. Owner, reviewers and labels edit in place.
 */
export function AboutFacts() {
  const { page, stats } = usePageScreen();
  const { person } = usePeople();
  const contributors = useContributors(page.id, [page.createdBy, page.updatedBy, page.ownerId]);
  const by = (id: string | null) => (id ? ` by ${person(id)?.name ?? 'Someone'}` : '');
  return (
    <FieldList size="panel" className="rounded-control border border-line px-3 py-1">
      <FieldRow label="Status">
        <PageStatusPill status={page.status} />
      </FieldRow>
      <FieldRow label="Owner">
        <OwnerField />
      </FieldRow>
      <FieldRow label="Reviewers">
        <ReviewersField />
      </FieldRow>
      <FieldRow label="Labels">
        <LabelsField />
      </FieldRow>
      <FieldRow label="Length">
        {stats.words.toLocaleString('en')} {stats.words === 1 ? 'word' : 'words'}
        {stats.minutes > 0 && <span className="text-tx-3">· {stats.minutes} min read</span>}
      </FieldRow>
      <FieldRow label="Created">
        {shortDate(page.createdAt)}
        {by(page.createdBy)}
      </FieldRow>
      <FieldRow label="Updated">
        {formatRelative(page.contentUpdatedAt)}
        {by(page.updatedBy)}
      </FieldRow>
      <FieldRow label="Contributors">
        <span
          className="inline-flex flex-wrap items-center gap-1"
          aria-label={`${contributors.length} contributors`}
        >
          {contributors.map((id) => {
            const name = person(id)?.name ?? 'Someone';
            return (
              <span key={id} title={name} className="inline-flex">
                <Avatar name={name} hue={avatarHue(id)} size={20} />
              </span>
            );
          })}
        </span>
      </FieldRow>
    </FieldList>
  );
}
