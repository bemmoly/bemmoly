import { useId, useState, type ReactNode } from 'react';
import { Button } from '../button/button.tsx';
import { Field } from '../input/field.tsx';
import { Input } from '../input/input.tsx';
import { Modal } from '../modal/modal.tsx';

export interface ConfirmChangeProps {
  open: boolean;
  /** A question naming the change: "Lower retention?". */
  title: string;
  /** One line under the title. */
  description?: ReactNode;
  /** What will happen, in plain words, one consequence per item. */
  consequences: readonly ReactNode[];
  /**
   * For changes that lose data or availability: the word or name the person types to confirm
   * ("confirm", the destination name). Leave it out for a plain confirmation.
   */
  confirmWord?: string;
  /** The confirm button's label: name the action ("Lower retention"), never "OK". */
  confirmLabel: string;
  /** danger for losses (red button); caution for a change that can be undone. */
  tone?: 'danger' | 'caution';
  busy?: boolean;
  /** A failed request, shown above the buttons. */
  error?: ReactNode;
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Inner part, mounted per opening so the typed word starts empty every time. */
function ConfirmBody(props: ConfirmChangeProps) {
  const { title, description, consequences, confirmWord, confirmLabel, tone = 'danger' } = props;
  const [typed, setTyped] = useState('');
  const listId = useId();
  const matches = !confirmWord || typed.trim().toLowerCase() === confirmWord.toLowerCase();
  const confirm = () => {
    if (matches && !props.busy) props.onConfirm();
  };
  return (
    <Modal
      open
      onClose={props.onCancel}
      width="md"
      title={title}
      description={description}
      footer={
        <>
          <Button onClick={props.onCancel}>Cancel</Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            disabled={!matches}
            loading={props.busy ?? false}
            onClick={confirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-3.5"
        aria-describedby={listId}
        onSubmit={(event) => {
          event.preventDefault();
          confirm();
        }}
      >
        <p className="m-0 text-13 font-medium text-tx">What happens</p>
        <ul
          id={listId}
          className="m-0 -mt-2 flex list-disc flex-col gap-1.5 pl-5 text-13 leading-body text-tx-body"
        >
          {consequences.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
        {props.children}
        {confirmWord ? (
          <Field
            label={
              <>
                Type <span className="font-mono font-medium text-tx select-all">{confirmWord}</span>{' '}
                to confirm
              </>
            }
          >
            <Input
              mono
              autoFocus
              autoComplete="off"
              spellCheck={false}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
            />
          </Field>
        ) : null}
        {props.error}
      </form>
    </Modal>
  );
}

/**
 * Asks before a change that can lose data or availability and says, in plain words, what
 * will happen. The dangerous ones ask for a typed word, so a slip of the mouse cannot do it.
 */
export function ConfirmChange(props: ConfirmChangeProps) {
  return props.open ? <ConfirmBody {...props} /> : null;
}
