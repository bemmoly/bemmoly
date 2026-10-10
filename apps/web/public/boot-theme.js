/* global document */
/*
 * Puts the look this device last showed on <html> before the first paint, so the boot frame
 * is dark for someone who works in dark. The CSP forbids inline scripts, so it is a file of
 * its own, loaded first; the app writes the key when it applies a theme (lib/boot-frame.ts).
 */
(function () {
  try {
    var look = JSON.parse(localStorage.getItem('bemmoly.boot-look') || 'null');
    if (!look || typeof look !== 'object') return;
    var root = document.documentElement;
    if (typeof look.theme === 'string') root.dataset.theme = look.theme;
    if (look.mode === 'light' || look.mode === 'dark') root.dataset.mode = look.mode;
    var vars = look.vars && typeof look.vars === 'object' ? look.vars : {};
    for (var name in vars) {
      if (name.indexOf('--') === 0 || name === 'color-scheme') {
        root.style.setProperty(name, String(vars[name]));
      }
    }
  } catch {
    // Storage blocked or the value unreadable: the boot frame keeps the default look.
  }
})();
