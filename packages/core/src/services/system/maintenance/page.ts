import type { MaintenanceState } from './state.ts';

const escape = (value: string) => value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/**
 * The page people see while a restore, update or rollback runs. The updater serves a
 * copy of the same markup while the app container is down; it reloads itself.
 */
export function renderMaintenancePage(state: MaintenanceState): string {
  const step = state.step ? `<p class="step">${escape(state.step)}</p>` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="5">
<title>Bemmoly is under maintenance</title>
<style>
  :root { color-scheme: light dark; --bg: #f7f8fa; --fg: #1d2330; --muted: #6b7483; --accent: #2356c9; }
  @media (prefers-color-scheme: dark) { :root { --bg: #14171d; --fg: #e8eaee; --muted: #9aa3b2; --accent: #7aa2ff; } }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--bg); color: var(--fg);
    font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 440px; padding: 32px 16px; text-align: center; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  p { margin: 0 0 8px; color: var(--muted); }
  .step { color: var(--accent); font-weight: 500; }
</style>
</head>
<body>
<main>
  <h1>Bemmoly will be back shortly</h1>
  <p>${escape(state.message)}</p>
  ${step}
  <p>This page refreshes by itself.</p>
</main>
</body>
</html>
`;
}
