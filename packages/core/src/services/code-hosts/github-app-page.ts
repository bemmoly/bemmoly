import { createHash } from 'node:crypto';

/*
 * The handoff page between Bemmoly and GitHub. GitHub takes a manifest only as a form POST,
 * and the app's own policy lets forms post nowhere but here, so this one page carries its
 * own policy: the form may post to that GitHub only, and the one script allowed (by hash)
 * submits it. Without scripts, the button does the same.
 */

const SCRIPT = 'document.getElementById("github").submit();';
const STYLE = `:root{color-scheme:light dark}
body{margin:0;min-height:100vh;display:grid;place-items:center;font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:440px;padding:32px 16px;text-align:center}
h1{font-size:20px;margin:0 0 8px}
p{margin:0 0 16px;opacity:.75}
button{font:inherit;padding:6px 14px;cursor:pointer}`;

const hashOf = (text: string) => `'sha256-${createHash('sha256').update(text).digest('base64')}'`;
const SCRIPT_HASH = hashOf(SCRIPT);
const STYLE_HASH = hashOf(STYLE);

const escape = (value: string) => value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

export interface GithubAppPage {
  html: string;
  /** Replaces the app's policy for this one response. */
  contentSecurityPolicy: string;
}

export function renderGithubAppPage(action: string, manifest: string): GithubAppPage {
  const target = new URL(action).origin;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>Opening GitHub</title>
<style>${STYLE}</style>
</head>
<body>
<main>
  <h1>Opening GitHub</h1>
  <p>GitHub asks you to create the app, then to choose its repositories.</p>
  <form id="github" method="post" action="${escape(action)}">
    <input type="hidden" name="manifest" value="${escape(manifest)}">
    <button type="submit">Continue to GitHub</button>
  </form>
</main>
<script>${SCRIPT}</script>
</body>
</html>
`;
  const contentSecurityPolicy = [
    "default-src 'none'",
    `script-src ${SCRIPT_HASH}`,
    `style-src ${STYLE_HASH}`,
    `form-action ${target}`,
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
  return { html, contentSecurityPolicy };
}
