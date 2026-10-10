/** Where the banner's call to action goes: the site's recommended install path. */
export const INSTALL_URL = 'https://bemmoly.com/self-hosting#recommended';

/**
 * The slim strip above the shell that says what this is: a demo whose data resets on reload,
 * with the way to the real thing. Plain DOM outside React's root, so the shell stays as an
 * install renders it; demo.css takes the strip's height from the shell's full-screen frame.
 */
export function showBanner(): HTMLElement {
  const banner = document.createElement('aside');
  banner.id = 'demo-banner';
  banner.setAttribute('aria-label', 'About this demo');
  banner.className =
    'flex h-(--demo-banner) shrink-0 items-center justify-center gap-2 border-b border-acc-100 ' +
    'bg-acc-50 px-4 text-12 whitespace-nowrap text-tx-2';

  const label = document.createElement('span');
  label.className = 'inline-flex items-center gap-1.5 font-semibold text-acc';
  const dot = document.createElement('span');
  dot.className = 'size-1.5 rounded-full bg-acc motion-safe:animate-pulse';
  dot.setAttribute('aria-hidden', 'true');
  label.append(dot, 'Live demo');

  const note = document.createElement('span');
  note.textContent = 'data resets on reload';

  const install = document.createElement('a');
  install.href = INSTALL_URL;
  install.className = 'font-medium underline-offset-2 hover:underline';
  install.textContent = 'Install Bemmoly';

  const separator = () => {
    const dotSeparator = document.createElement('span');
    dotSeparator.className = 'text-tx-3';
    dotSeparator.setAttribute('aria-hidden', 'true');
    dotSeparator.textContent = '·';
    return dotSeparator;
  };
  banner.append(label, separator(), note, separator(), install);
  document.body.prepend(banner);
  document.documentElement.dataset['demoBanner'] = '';
  return banner;
}
