/**
 * The phone menu (Nav.astro): a modal dialog, so the browser keeps focus inside it, closes it
 * on Esc and hands focus back to the button. Following a link, pressing outside it or the
 * window growing to the desktop layout closes it too.
 */
export function enhanceMenu(): void {
  const button = document.querySelector<HTMLButtonElement>('[data-menu-open]');
  const dialog = document.querySelector<HTMLDialogElement>('#site-menu');
  if (!button || !dialog) return;
  const close = () => dialog.close();

  button.addEventListener('click', () => {
    dialog.showModal();
    button.setAttribute('aria-expanded', 'true');
  });
  dialog.addEventListener('close', () => {
    button.setAttribute('aria-expanded', 'false');
    button.focus();
  });
  for (const control of dialog.querySelectorAll('[data-menu-close], a')) {
    control.addEventListener('click', close);
  }
  // A press on the backdrop lands on the dialog itself, never on its content.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
  matchMedia('(min-width: 1024px)').addEventListener('change', (query) => {
    if (query.matches && dialog.open) close();
  });
}
