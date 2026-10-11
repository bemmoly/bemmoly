/*
 * The fake Jira site names its project OPS and its people person0@example.test and the like.
 * Imported as they are, they would land on a real install as project OPS and forty invited
 * people outside the harness's naming, and one could even match a real account by email. The
 * proxy rewrites them on the way out (and the project key back on the way in), so everything
 * an import creates is LOAD-prefixed, under the load-test email domain, and found by teardown.
 */
import { LOAD_EMAIL_DOMAIN, LOAD_PREFIX } from '../lib/credentials.ts';

export const SOURCE_KEY = 'OPS';
export const IMPORT_KEY = `${LOAD_PREFIX}J`;
export const IMPORT_NAME = `${LOAD_PREFIX} Jira import`;
/** The fixture project's id on the fake site. */
export const SOURCE_PROJECT_ID = '10000';

const EMAIL = /"([A-Za-z0-9._+-]+)@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"/g;
const DISPLAY_NAME = /"displayName":"(?!LOAD )([^"\\]*)"/g;

/** A JSON response body from the fake site, as the install should see it. */
export function rewriteResponse(body: string): string {
  return body
    .replaceAll(`"${SOURCE_KEY}"`, `"${IMPORT_KEY}"`)
    .replace(new RegExp(`\\b${SOURCE_KEY}-(\\d+)\\b`, 'g'), `${IMPORT_KEY}-$1`)
    .replaceAll('"name":"Operations"', `"name":"${IMPORT_NAME}"`)
    .replace(EMAIL, (_, local: string) => `"load-jira-${local.toLowerCase()}@${LOAD_EMAIL_DOMAIN}"`)
    .replace(DISPLAY_NAME, (_, name: string) => `"displayName":"${LOAD_PREFIX} ${name}"`);
}

/** A request path, query or body from the install, as the fake site expects it. */
export function rewriteRequest(text: string): string {
  return text.replace(new RegExp(`(?<![A-Za-z])${IMPORT_KEY}(?![A-Za-z])`, 'g'), SOURCE_KEY);
}
