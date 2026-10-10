import { Avatar, avatarHue, Checkbox, Input } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api } from '../../shared/api.ts';
import { docsKeys } from '../../shared/keys.ts';

/** The server refuses more than this many reviewers on one page. */
export const MAX_REVIEWERS = 20;

/**
 * Who may review a page in the space: its active members with review rights and the org
 * admins, as the server decides it, so everyone offered is accepted.
 */
function useReviewerCandidates(spaceKey: string) {
  return useQuery({
    queryKey: docsKeys.members(spaceKey),
    queryFn: () => api.docs.members.list(spaceKey),
    staleTime: 60_000,
    select: (response) =>
      response.items
        .filter((member) => member.canReview && member.status === 'active')
        .map((member) => ({
          id: member.userId,
          name: member.name.trim() || member.email,
          email: member.email,
        })),
  });
}

export interface ReviewerListProps {
  spaceKey: string;
  chosen: readonly string[];
  onToggle: (id: string) => void;
  /** The owner and the signed-in person, who do not review their own page. */
  exclude?: readonly string[];
  autoFocus?: boolean;
}

/**
 * A filter and the people who may review, each with a checkbox: the body of the Request
 * review dialog and of the Reviewers property's popover.
 */
export function ReviewerList({
  spaceKey,
  chosen,
  onToggle,
  exclude = [],
  autoFocus,
}: ReviewerListProps) {
  const people = useReviewerCandidates(spaceKey);
  const [filter, setFilter] = useState('');
  const shown = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return (people.data ?? []).filter(
      (person) =>
        !exclude.includes(person.id) &&
        (!needle || `${person.name} ${person.email}`.toLowerCase().includes(needle)),
    );
  }, [people.data, filter, exclude]);

  return (
    <div className="flex flex-col gap-2.5">
      <Input
        aria-label="Find people"
        placeholder="Find people"
        autoFocus={autoFocus}
        prefix={<Icon name="search" size={14} />}
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
      />
      <ul
        aria-label="People"
        className="m-0 flex max-h-72 list-none flex-col gap-px overflow-auto p-0"
      >
        {people.isPending && <li className="px-2 py-2 text-12h text-tx-3">Loading people…</li>}
        {people.isSuccess && shown.length === 0 && (
          <li className="px-2 py-2 text-12h text-tx-3">
            {filter.trim()
              ? `Nobody matches “${filter.trim()}”.`
              : 'Nobody else in this space can review yet. Add people to the space first.'}
          </li>
        )}
        {people.isError && (
          <li role="alert" className="px-2 py-2 text-12h text-danger">
            The people of this space did not load.
          </li>
        )}
        {shown.map((person) => (
          <li key={person.id}>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-hover">
              <Checkbox
                size="sm"
                aria-label={person.name}
                checked={chosen.includes(person.id)}
                disabled={!chosen.includes(person.id) && chosen.length >= MAX_REVIEWERS}
                onChange={() => onToggle(person.id)}
              />
              <Avatar name={person.name} hue={avatarHue(person.id)} size={22} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-13 text-tx">{person.name}</span>
                <span className="truncate text-11h text-tx-3">{person.email}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
