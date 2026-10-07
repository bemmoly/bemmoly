import type { EmailTestResult, OutboxSummary } from '@bemmoly/shared';

/** One DNS check from the test send, in words the page can show as is. */
export interface DnsCheckView {
  name: 'SPF' | 'DMARC';
  status: string;
  ok: boolean;
  /** The record to add when the check did not pass. */
  toAdd: string | null;
  /** The record found, when it passed and the server said what it was. */
  found: string | null;
}

export interface TestResultView {
  sent: boolean;
  headline: string;
  /** Where the conversation failed ("auth", "connect"), or null when it was sent. */
  stage: string | null;
  serverResponse: string | null;
  domain: string | null;
  dns: DnsCheckView[];
}

type Verdict = NonNullable<EmailTestResult['deliverability']>['spf'];

const PASSING = new Set(['pass', 'ok', 'valid', 'found']);

export function dnsCheck(name: DnsCheckView['name'], verdict: Verdict): DnsCheckView {
  const detail = typeof verdict === 'string' ? { status: verdict } : verdict;
  const status = (detail.status ?? 'unknown').toLowerCase();
  const ok = PASSING.has(status);
  const record = detail.record ?? null;
  const expected = detail.expected ?? null;
  return {
    name,
    status,
    ok,
    toAdd: ok ? null : (expected ?? record),
    found: ok ? record : null,
  };
}

function through(provider: string): string {
  if (provider === 'smtp') return 'your SMTP relay';
  if (provider === 'log')
    return 'the log provider, so it is in the dev mailbox rather than an inbox';
  return `the ${provider} provider`;
}

/** The test send in plain words: where it went, or which stage failed and what the server said. */
export function testResultView(result: EmailTestResult): TestResultView {
  const dns = result.deliverability
    ? [dnsCheck('SPF', result.deliverability.spf), dnsCheck('DMARC', result.deliverability.dmarc)]
    : [];
  if (result.sent) {
    return {
      sent: true,
      headline: `Sent to ${result.to} through ${through(result.provider)}.`,
      stage: null,
      serverResponse: null,
      domain: result.deliverability?.domain ?? null,
      dns,
    };
  }
  return {
    sent: false,
    headline: result.failure?.message ?? `The test email to ${result.to} was not sent.`,
    stage: result.failure?.stage ?? null,
    serverResponse: result.failure?.serverResponse ?? null,
    domain: result.deliverability?.domain ?? null,
    dns,
  };
}

const DAY = 24 * 60 * 60_000;
const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** "today", "yesterday", "Tuesday" within the week, then "Oct 2". */
export function sinceLabel(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const days = Math.round((startOfDay(now) - startOfDay(then)) / DAY);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return then.toLocaleDateString('en', { weekday: 'long' });
  return then.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

/** The outbox line the tech design asks for: "12 emails failed since Tuesday: authentication rejected". */
export function outboxStatus(summary: OutboxSummary, now: Date = new Date()): string {
  const failures = summary.failures;
  if (!failures || failures.count === 0) return 'No emails have failed.';
  const noun = failures.count === 1 ? 'email' : 'emails';
  const since = failures.since ? ` since ${sinceLabel(failures.since, now)}` : '';
  const reason = failures.topReason ? `: ${failures.topReason}` : '.';
  return `${failures.count} ${noun} failed${since}${reason}`;
}

/** Counts in a stable order, the ones the outbox names first. */
export function outboxCounts(summary: OutboxSummary): Array<{ label: string; count: number }> {
  const order = ['queued', 'sending', 'sent', 'failed'];
  return Object.entries(summary.counts)
    .sort(([a], [b]) => rank(order, a) - rank(order, b))
    .map(([label, count]) => ({ label, count }));
}

const rank = (order: string[], key: string) => {
  const index = order.indexOf(key);
  return index === -1 ? order.length : index;
};
