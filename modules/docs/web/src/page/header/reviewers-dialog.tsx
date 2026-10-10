import { Avatar, avatarHue, Button, Checkbox, Input, Modal } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api } from '../../shared/api.ts';
import { docsKeys } from '../../shared/keys.ts';

export interface ReviewersDialogProps {
  open: boolean;
  /** The page's space: reviewers are the people who may review in it. */
  spaceKey: string;
  /** Who is chosen when it opens. */
  initial: readonly string[];
  /** "Request review" while moving to in review; "Save reviewers" when only editing them. */
  confirmLabel: string;
  /** The owner and the signed-in person, who do not review their own page. */
  exclude?: readonly string[];
  pending?: boolean;
  /** At least one reviewer: the server refuses a review with nobody named. */
  required?: boolean;
  /** Why the last attempt failed, shown above the buttons. */
  error?: string | null;
  onConfirm: (reviewers: string[]) => void;
  onClose: () => void;
}

const MAX_REVIEWERS = 20;

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

/**
 * Picks who reviews the page: the step between draft and in review, and the Reviewers row of
 * the About panel. A review needs someone named, so Request review waits for a first pick;
 * what the server refuses (someone who is not in the space) is said in the dialog itself.
 */
export function ReviewersDialog(props: ReviewersDialogProps) {
  return props.open ? <ReviewersForm {...props} /> : null;
}

function ReviewersForm({
  open,
  spaceKey,
  initial,
  confirmLabel,
  exclude = [],
  pending,
  required = false,
  error,
  onConfirm,
  onClose,
}: ReviewersDialogProps) {
  const people = useReviewerCandidates(spaceKey);
  const [chosen, setChosen] = useState<string[]>(() => [...initial]);
  const [filter, setFilter] = useState('');
  const shown = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return (people.data ?? []).filter(
      (person) =>
        !exclude.includes(person.id) &&
        (!needle || `${person.name} ${person.email}`.toLowerCase().includes(needle)),
    );
  }, [people.data, filter, exclude]);
  const toggle = (id: string) =>
    setChosen((list) =>
      list.includes(id)
        ? list.filter((item) => item !== id)
        : list.length < MAX_REVIEWERS
          ? [...list, id]
          : list,
    );

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="sm"
      title="Reviewers"
      description="They are asked to read the page and publish it, or send it back to draft."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {error && (
            <span role="alert" className="mr-auto min-w-0 text-12h text-danger">
              {error}
            </span>
          )}
          <Button
            variant="primary"
            loading={pending}
            disabled={required && chosen.length === 0}
            onClick={() => onConfirm(chosen)}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2.5">
        <Input
          aria-label="Find people"
          placeholder="Find people"
          autoFocus
          prefix={<Icon name="search" size={14} />}
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
        <ul
          aria-label="People"
          className="m-0 flex max-h-72 list-none flex-col gap-px overflow-auto p-0"
        >
          {people.isPending && <li className="px-2 py-2 text-12h text-tx5">Loading people…</li>}
          {people.isSuccess && shown.length === 0 && (
            <li className="px-2 py-2 text-12h text-tx5">
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
              <label className="flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 hover:bg-bg2">
                <Checkbox
                  size="sm"
                  aria-label={person.name}
                  checked={chosen.includes(person.id)}
                  onChange={() => toggle(person.id)}
                />
                <Avatar name={person.name} hue={avatarHue(person.id)} size={22} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-13 text-tx">{person.name}</span>
                  <span className="truncate text-11h text-tx5">{person.email}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
