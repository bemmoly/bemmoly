/**
 * Copy buttons ([data-copy], CopyButton.astro). A copy turns the drawn icon into a check, says
 * "Copied" for two seconds and announces it in the page's polite live region. When the
 * clipboard is refused, the command's text is selected instead and the button says which keys
 * copy it, so the visitor is never left with a button that did nothing.
 */
const RESET_MS = 2000;
const timers = new WeakMap<HTMLElement, number>();

export function announce(message: string): void {
  const region = document.querySelector<HTMLElement>('[data-live-status]');
  if (!region) return;
  // Cleared first, so the same words twice in a row are still read out.
  region.textContent = '';
  requestAnimationFrame(() => (region.textContent = message));
}

/** Selects an element's text, the clipboard's fallback: one key press from copied. */
function selectText(element: Element | null): void {
  if (!element) return;
  const range = document.createRange();
  range.selectNodeContents(element);
  const selection = getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function show(button: HTMLElement, state: 'done' | 'manual', label: string): void {
  const text = button.querySelector('[data-copy-label]');
  // The resting label, read once: a second press during "Copied" must not keep "Copied".
  button.dataset['idle'] ??= text?.textContent ?? '';
  button.dataset['state'] = state;
  if (text) text.textContent = label;
  announce(label);
  clearTimeout(timers.get(button));
  timers.set(
    button,
    window.setTimeout(() => {
      delete button.dataset['state'];
      if (text) text.textContent = button.dataset['idle'] ?? '';
    }, RESET_MS),
  );
}

export async function copy(button: HTMLElement, value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    show(button, 'done', 'Copied');
  } catch {
    const target = button.dataset['copyTarget'];
    selectText(target ? document.getElementById(target) : null);
    const keys = /Mac|iPhone|iPad/.test(navigator.platform) ? 'Cmd+C' : 'Ctrl+C';
    show(button, 'manual', `Press ${keys}`);
  }
}

export function enhanceCopy(): void {
  for (const button of document.querySelectorAll<HTMLElement>('[data-copy]')) {
    button.addEventListener('click', () => void copy(button, button.dataset['copy'] ?? ''));
  }
}
