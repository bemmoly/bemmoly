import { Button, Modal } from '@bemmoly/ui';
import { useState } from 'react';
import { MAX_REVIEWERS, ReviewerList } from './reviewer-list.tsx';

export interface ReviewersDialogProps {
  open: boolean;
  /** The page's space: reviewers are the people who may review in it. */
  spaceKey: string;
  /** Who is chosen when it opens. */
  initial: readonly string[];
  /** The confirm button: "Request review". */
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

/**
 * Picks who reviews the page on the step between draft and in review. A review needs someone
 * named, so Request review waits for a first pick; what the server refuses (someone who is not
 * in the space) is said in the dialog itself. Changing reviewers later is the Reviewers
 * property's popover.
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
  const [chosen, setChosen] = useState<string[]>(() => [...initial]);
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
            <span role="alert" className="mr-auto min-w-0 text-13 text-red">
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
      <ReviewerList
        spaceKey={spaceKey}
        chosen={chosen}
        onToggle={toggle}
        exclude={exclude}
        autoFocus
      />
    </Modal>
  );
}
