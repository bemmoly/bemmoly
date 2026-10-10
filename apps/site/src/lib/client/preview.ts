/**
 * The product previews (ProductPreview.astro): tabs switch posters captured from the demo, and
 * "Try it live" frames the demo route over the poster at the poster's own size, scaled to fit,
 * so nothing on the page moves. Nothing loads until that press. The wait shows a skeleton and
 * says what is happening; a demo that has not drawn in eight seconds is replaced by plain
 * words, Retry and Open in a new tab. Esc inside the live frame hands focus back to the tabs.
 * Frames too narrow to use the app in (phones) keep the links, which open the full demo.
 */
import { makeTabs, plainClick } from './tabs.ts';

const PHONE = 640;
const GIVE_UP_MS = 8000;

export function enhancePreviews(): void {
  for (const figure of document.querySelectorAll<HTMLElement>('[data-preview]')) enhance(figure);
}

function enhance(figure: HTMLElement): void {
  const part = <T extends HTMLElement>(name: string) =>
    figure.querySelector<T>(`[data-${name}]`) ?? undefined;
  const list = part('tabs');
  const frame = part('frame');
  const tryLink = part<HTMLAnchorElement>('try');
  const loading = part('loading');
  const failed = part('failed');
  if (!list || !frame || !tryLink || !loading || !failed) return;
  const tabs = [...list.querySelectorAll<HTMLAnchorElement>('[data-tab]')];
  const size = { width: Number(figure.dataset['width']), height: Number(figure.dataset['height']) };
  let live: HTMLIFrameElement | null = null;
  let current = tabs[0];

  const select = makeTabs(list, (index) => {
    current = tabs[index];
    if (!current) return;
    frame.setAttribute('aria-labelledby', current.id);
    for (const poster of frame.querySelectorAll<HTMLElement>('[data-poster]')) {
      poster.hidden = poster.dataset['poster'] !== current.dataset['tab'];
    }
    tryLink.href = current.href;
    for (const link of figure.querySelectorAll<HTMLAnchorElement>('[data-follow]')) {
      link.href = current.href;
    }
    if (live) visit(live, current.pathname);
  });
  frame.setAttribute('role', 'tabpanel');
  select(0);

  const reset = () => {
    live?.remove();
    live = null;
    loading.hidden = true;
    tryLink.hidden = false;
  };
  const start = () => {
    reset();
    failed.hidden = true;
    loading.hidden = false;
    tryLink.hidden = true;
    const started = performance.now();
    const iframe = frameDemo(frame, current?.href ?? tryLink.href, size);
    live = iframe;
    iframe.addEventListener(
      'load',
      () => {
        whenDrawn(iframe, started, () => {
          if (live !== iframe) return;
          loading.hidden = true;
          iframe.classList.remove('opacity-0');
          iframe.focus();
          // Esc in the app returns to the page: the frame is same-origin, so its keys reach us.
          iframe.contentWindow?.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') current?.focus();
          });
        });
      },
      { once: true },
    );
    window.setTimeout(() => {
      if (live === iframe && !loading.hidden) {
        reset();
        tryLink.hidden = true;
        failed.hidden = false;
        failed.querySelector<HTMLElement>('[data-retry]')?.focus();
      }
    }, GIVE_UP_MS);
  };

  tryLink.addEventListener('click', (event) => {
    if (!plainClick(event) || frame.clientWidth < PHONE) return;
    event.preventDefault();
    start();
  });
  failed.querySelector('[data-retry]')?.addEventListener('click', start);

  // "Try the live demo" in the hero starts this preview in place rather than leaving the page.
  for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-start-preview]')) {
    link.addEventListener('click', (event) => {
      if (!plainClick(event) || frame.clientWidth < PHONE) return;
      event.preventDefault();
      const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
      figure.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' });
      if (!live) start();
    });
  }
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
  href: string,
  size: { width: number; height: number },
): HTMLIFrameElement {
  const url = new URL(href, location.href);
  // The demo opens in the same theme the visitor sees the page in.
  if (getComputedStyle(document.documentElement).colorScheme === 'dark') {
    url.searchParams.set('theme', 'dark');
  }
  const iframe = document.createElement('iframe');
  iframe.src = `${url.pathname}${url.search}`;
  iframe.title = 'Live demo of Bemmoly';
  iframe.className =
    'absolute top-0 left-0 z-1 origin-top-left border-0 bg-canvas opacity-0 motion-safe:transition-opacity motion-safe:duration-base';
  iframe.style.width = `${size.width}px`;
  iframe.style.height = `${size.height}px`;
  const fit = () => {
    iframe.style.transform = `scale(${frame.clientWidth / size.width})`;
  };
  fit();
  new ResizeObserver(fit).observe(frame);
  frame.append(iframe);
  return iframe;
}

/**
 * Calls `done` once the framed app has drawn: its root holds the shell and its boot frame is
 * gone. A page that is not the app (an error page, a blocked frame we cannot read) never
 * passes, so the caller's timer shows the failure instead of a wrong page.
 */
function whenDrawn(iframe: HTMLIFrameElement, started: number, done: () => void): void {
  const drawn = () => {
    try {
      const doc = iframe.contentDocument;
      return Boolean(doc?.getElementById('root')?.firstElementChild && !doc.getElementById('boot'));
    } catch {
      return false;
    }
  };
  const check = () => {
    if (!iframe.isConnected || performance.now() - started > GIVE_UP_MS) return;
    if (drawn()) done();
    else window.setTimeout(check, 50);
  };
  check();
}
