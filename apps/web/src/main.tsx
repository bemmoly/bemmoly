import './styles.css';

/**
 * Resolves once the browser has painted, so the static boot frame in
 * index.html reaches the screen before the app's JavaScript is evaluated.
 * A hidden tab never paints, so it does not wait.
 */
function afterFirstPaint(): Promise<void> {
  if (document.visibilityState === 'hidden') return Promise.resolve();
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
}

async function boot(): Promise<void> {
  await afterFirstPaint();
  const { mount } = await import('./mount.tsx');
  await mount();
}

void boot();
