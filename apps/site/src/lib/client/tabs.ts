/**
 * Tabs with a roving tabindex: arrow keys move between tabs, Home and End jump to the ends,
 * and only the selected tab is in the Tab order. The markup is links, so without the script
 * they still go somewhere: a demo route for the previews, the panel's own anchor for the
 * install paths, where every panel stays visible until the script hides the others.
 */
const MOVES: Readonly<Record<string, (at: number, last: number) => number>> = {
  ArrowRight: (at, last) => (at === last ? 0 : at + 1),
  ArrowLeft: (at, last) => (at === 0 ? last : at - 1),
  Home: () => 0,
  End: (_, last) => last,
};

export const plainClick = (event: MouseEvent) =>
  event.button === 0 && !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);

/** Wires a tablist; returns `select(index, focus?)` for callers that drive it themselves. */
export function makeTabs(
  list: HTMLElement,
  onSelect: (index: number, tab: HTMLElement) => void,
): (index: number, focus?: boolean) => void {
  const tabs = [...list.querySelectorAll<HTMLElement>('[data-tab]')];
  list.setAttribute('role', 'tablist');
  // Named only once it is a tablist: until then it is a row of links.
  if (list.dataset['label']) list.setAttribute('aria-label', list.dataset['label']);
  const select = (index: number, focus = false) => {
    const tab = tabs[index];
    if (!tab) return;
    tabs.forEach((other, n) => {
      other.setAttribute('aria-selected', String(n === index));
      other.toggleAttribute('data-active', n === index);
      other.tabIndex = n === index ? 0 : -1;
    });
    onSelect(index, tab);
    if (focus) tab.focus();
  };
  tabs.forEach((tab, index) => {
    tab.setAttribute('role', 'tab');
    tab.addEventListener('click', (event) => {
      if (!plainClick(event)) return;
      event.preventDefault();
      select(index);
    });
  });
  list.addEventListener('keydown', (event) => {
    const move = MOVES[event.key];
    if (!move) return;
    event.preventDefault();
    const at = tabs.findIndex((tab) => tab.hasAttribute('data-active'));
    select(move(Math.max(at, 0), tabs.length - 1), true);
  });
  return select;
}

/**
 * Tab groups whose panels are elements on the page ([data-tabgroup]): the install paths. The
 * selected path is kept in the address (#install-compose), so it can be shared and reopened.
 */
export function enhanceTabs(): void {
  for (const group of document.querySelectorAll<HTMLElement>('[data-tabgroup]')) {
    const list = group.querySelector<HTMLElement>('[data-tablist]');
    const panels = [...group.querySelectorAll<HTMLElement>('[data-tabpanel]')];
    if (!list || panels.length === 0) continue;
    let ready = false;
    const hashOf = (tab: HTMLElement) =>
      new URL(tab.getAttribute('href') ?? '', location.href).hash;
    const select = makeTabs(list, (index, tab) => {
      panels.forEach((panel, n) => {
        panel.hidden = n !== index;
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', tab.id);
      });
      const hash = hashOf(tab);
      if (ready && hash) history.replaceState(null, '', hash);
    });
    const tabs = [...list.querySelectorAll<HTMLElement>('[data-tab]')];
    const asked = tabs.findIndex((tab) => location.hash && hashOf(tab) === location.hash);
    select(Math.max(asked, 0));
    ready = true;
  }
}
