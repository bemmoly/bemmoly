import type { Browser, Page } from '@playwright/test';
import type { WorkApi } from './work-api.ts';

export const PASSWORD = 'a long enough passphrase';

export interface Someone {
  id: string;
  name: string;
  email: string;
  password: string;
}

/** A new member with a password, invited and accepted the way a real person joins. */
export async function newPerson(admin: WorkApi, baseURL: string, label: string): Promise<Someone> {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `${label}.${stamp}@acmelabs.dev`;
  const name = `${label[0]?.toUpperCase()}${label.slice(1)} Tester`;
  const { items } = await admin.call<{ items: { acceptUrl: string }[] }>('POST', '/invitations', {
    emails: [email],
  });
  const token = new URL(items[0]?.acceptUrl ?? baseURL).hash.replace('#token=', '');
  const accepted = await fetch(`${baseURL}/api/v1/auth/invitations/${token}/accept`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: baseURL },
    body: JSON.stringify({ name, password: PASSWORD }),
  });
  if (!accepted.ok) throw new Error(`accept ${email}: ${accepted.status} ${await accepted.text()}`);
  const { user } = (await accepted.json()) as { user: { id: string } };
  return { id: user.id, name, email, password: PASSWORD };
}

/** A browser with nobody signed in. */
export async function signedOutPage(browser: Browser, baseURL: string): Promise<Page> {
  const context = await browser.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
  });
  return context.newPage();
}

/** The newest link in the dev mailbox for this address that matches, waiting for the job. */
export async function mailedLink(
  admin: WorkApi,
  to: string,
  pattern: RegExp,
  timeoutMs = 20_000,
): Promise<string> {
  const until = Date.now() + timeoutMs;
  let seen: string[] = [];
  while (Date.now() < until) {
    const { items } = await admin.call<{ items: { to: string[]; text: string | null }[] }>(
      'GET',
      '/dev/mailbox',
    );
    seen = items.map((item) => `${item.to.join(',')}: ${(item.text ?? '').slice(0, 300)}`);
    const mail = items.find(
      (item) => item.to.some((entry) => entry.includes(to)) && pattern.test(item.text ?? ''),
    );
    const link = mail?.text?.match(pattern)?.[0];
    if (link) return link;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`no mail for ${to} matching ${pattern}; saw ${JSON.stringify(seen.slice(0, 5))}`);
}
