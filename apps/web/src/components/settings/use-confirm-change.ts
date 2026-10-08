import type { ConfirmChangeProps } from '@bemmoly/ui';
import { useState } from 'react';

/** What a risky change needs said before it is saved; see ConfirmChange. */
export type ChangeConfirm = Pick<
  ConfirmChangeProps,
  'title' | 'description' | 'consequences' | 'confirmWord' | 'confirmLabel' | 'tone'
>;

/**
 * Runs a save straight away, or first asks with ConfirmChange when the change can lose data
 * or availability. `dialog` is spread onto ConfirmChange.
 */
export function useConfirmChange() {
  const [pending, setPending] = useState<{ spec: ChangeConfirm; run: () => void } | null>(null);
  const close = () => setPending(null);
  return {
    ask: (spec: ChangeConfirm | null, run: () => void) => {
      if (spec) setPending({ spec, run });
      else run();
    },
    dialog: {
      title: '',
      consequences: [],
      confirmLabel: '',
      ...pending?.spec,
      open: pending !== null,
      onCancel: close,
      onConfirm: () => {
        pending?.run();
        close();
      },
    } satisfies ConfirmChangeProps,
  };
}
