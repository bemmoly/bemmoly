/**
 * The homepage previews' script (LivePreview.astro). Turns the links into tabs that switch
 * posters, and on "Try it" frames the demo route over the poster at the poster's own size,
 * scaled to the frame, so the page does not move. Nothing loads until that click. Frames too
 * narrow to use the app in (phones) keep the links, which open the full demo.
 */
const PHONE = 640;
const KEYS = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];

const plainClick = (event: MouseEvent) =>
  event.button === 0 && !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);

export function enhancePreviews(root: ParentNode = document): void {
  for (const figure of root.querySelectorAll<HTMLElement>('[data-preview]')) enhance(figure);
}

function enhance(figure: HTMLElement): void {
  const tablist = figure.querySelector<HTMLElement>('[data-tabs]');
  const frame = figure.querySelector<HTMLElement>('[data-frame]');
  const tryLink = figure.querySelector<HTMLAnchorElement>('[data-try]');
  const tryLabel = figure.querySelector<HTMLElement>('[data-try-label]');
  const full = figure.querySelector<HTMLAnchorElement>('[data-full]');
  const tabs = [...figure.querySelectorAll<HTMLAnchorElement>('[data-tab]')];
  if (!tablist || !frame || !tryLink || !tryLabel || !full || tabs.length === 0) return;
  const width = Number(figure.dataset['width']) || 1280;
  const height = Number(figure.dataset['height']) || 744;
  let live: HTMLIFrameElement | null = null;

  tablist.setAttribute('role', 'tablist');
  tablist.setAttribute('aria-label', 'Live preview');
  frame.setAttribute('role', 'tabpanel');
  for (const tab of tabs) {
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', frame.id);
    tab.setAttribute('aria-selected', String(tab.hasAttribute('data-active')));
    tab.tabIndex = tab.hasAttribute('data-active') ? 0 : -1;
    if (tab.hasAttribute('data-active')) frame.setAttribute('aria-labelledby', tab.id);
  }

  const select = (tab: HTMLAnchorElement) => {
    for (const other of tabs) {
      const on = other === tab;
      other.toggleAttribute('data-active', on);
      other.setAttribute('aria-selected', String(on));
      other.tabIndex = on ? 0 : -1;
    }
    frame.setAttribute('aria-labelledby', tab.id);
    for (const poster of frame.querySelectorAll<HTMLElement>('[data-poster]')) {
      poster.hidden = poster.dataset['poster'] !== tab.dataset['tab'];
    }
    tryLink.href = tab.href;
    full.href = tab.href;
    tryLabel.textContent = tab.dataset['action'] ?? '';
    if (live) visit(live, tab.pathname);
  };

  for (const tab of tabs) {
    tab.addEventListener('click', (event) => {
      if (!plainClick(event)) return;
      event.preventDefault();
      select(tab);
    });
  }
  tablist.addEventListener('keydown', (event) => {
    if (!KEYS.includes(event.key)) return;
    event.preventDefault();
    const at = tabs.findIndex((tab) => tab.hasAttribute('data-active'));
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : (at + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    const tab = tabs[next];
    if (!tab) return;
    select(tab);
    tab.focus();
  });

  tryLink.addEventListener('click', (event) => {
    if (!plainClick(event) || frame.clientWidth < PHONE) return;
    event.preventDefault();
    live = frameDemo(frame, tryLink, { width, height });
  });
}

/** Moves the framed demo to `path` inside the app, keeping what the visitor changed. */
function visit(iframe: HTMLIFrameElement, path: string): void {
  try {
    const view = iframe.contentWindow;
    if (!view) throw new Error('no frame');
    view.history.pushState(null, '', path);
    view.dispatchEvent(new PopStateEvent('popstate'));
  } catch {
    iframe.src = path;
  }
}

function frameDemo(
  frame: HTMLElement,
  tryLink: HTMLAnchorElement,
  size: { width: number; height: number },
): HTMLIFrameElement {
  const url = new URL(tryLink.href);
  // The site's Ocean version frames the demo in the same preset.
  if (document.documentElement.dataset['theme'] === 'dark') url.searchParams.set('theme', 'ocean');
  const iframe = document.createElement('iframe');
  iframe.src = `${url.pathname}${url.search}`;
  iframe.title = 'Live demo of Bemmoly';
  iframe.className =
    'absolute top-0 left-0 z-1 origin-top-left border-0 bg-bg opacity-0 motion-safe:transition-opacity motion-safe:duration-300';
  iframe.style.width = `${size.width}px`;
  iframe.style.height = `${size.height}px`;
  const fit = () => {
    iframe.style.transform = `scale(${frame.clientWidth / size.width})`;
  };
  fit();
  new ResizeObserver(fit).observe(frame);
  const reveal = () => {
    iframe.classList.remove('opacity-0');
    tryLink.hidden = true;
    iframe.focus();
  };
  // The poster stays until the app has drawn its first screen, not just its boot frame.
  iframe.addEventListener('load', () => whenDrawn(iframe, reveal), { once: true });
  tryLink.setAttribute('aria-busy', 'true');
  frame.append(iframe);
  return iframe;
}

/** Calls `done` once the framed shell has replaced its boot frame, or after four seconds. */
function whenDrawn(iframe: HTMLIFrameElement, done: () => void): void {
  const started = performance.now();
  const check = () => {
    const booting = iframe.contentDocument?.getElementById('boot');
    if (!booting || performance.now() - started > 4000) done();
    else setTimeout(check, 50);
  };
  check();
}
