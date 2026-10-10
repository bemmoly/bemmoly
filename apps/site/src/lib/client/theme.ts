/**
 * The footer's System / Light / Dark control. System removes the choice, so the page follows
 * prefers-color-scheme again; Light and Dark set html[data-theme] and are remembered in this
 * browser, where ThemeScript.astro applies them before the next first paint. When storage is
 * blocked the choice lasts for the page only.
 */
const KEY = 'bemmoly.site.theme';
type Choice = 'system' | 'light' | 'dark';

function saved(): Choice {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

function apply(choice: Choice): void {
  const root = document.documentElement;
  if (choice === 'system') delete root.dataset['theme'];
  else root.dataset['theme'] = choice;
  try {
    if (choice === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    // Storage blocked: the choice holds until the page is left.
  }
}

export function enhanceTheme(): void {
  const control = document.querySelector<HTMLFieldSetElement>('[data-theme-control]');
  if (!control) return;
  const current = saved();
  for (const input of control.querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
    input.checked = input.value === current;
    input.addEventListener('change', () => apply(input.value as Choice));
  }
  control.hidden = false;
}
