/** How long a collaborator's caret keeps its name after they stop moving it. */
export const CARET_NAME_MS = 3000;

export interface CaretIdle {
  /** A caret's name label was drawn for this person: show it and start its clock. */
  attach: (userId: string, label: HTMLElement) => void;
  /** This person moved their caret or typed: show the name again and restart the clock. */
  touch: (userId: string) => void;
  destroy: () => void;
}

/**
 * Collaborator caret names fade once their owner has been idle for three seconds, so the
 * page reads clean while people sit still, and come back the moment they move. The label
 * gets `data-idle`; CSS fades it. The caret line itself always stays.
 */
export function createCaretIdle(delay = CARET_NAME_MS): CaretIdle {
  const labels = new Map<string, HTMLElement>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const touch = (userId: string) => {
    const label = labels.get(userId);
    if (!label) return;
    label.removeAttribute('data-idle');
    clearTimeout(timers.get(userId));
    timers.set(
      userId,
      setTimeout(() => labels.get(userId)?.setAttribute('data-idle', ''), delay),
    );
  };
  return {
    attach: (userId, label) => {
      labels.set(userId, label);
      touch(userId);
    },
    touch,
    destroy: () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      labels.clear();
    },
  };
}
