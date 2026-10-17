/*
 * JUnit XML, as every test runner writes it (Jest, Vitest, pytest, Go's gotestsum, Maven
 * Surefire), read into the release's test summary: only testcase elements and their failure,
 * error and skipped children matter. Read with the same XML parser the runner uses.
 */

import { DOMParser } from '@xmldom/xmldom';

export interface JunitFailure {
  file: string;
  name: string;
  message: string | null;
}

export interface JunitSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  failures: JunitFailure[];
}

/** The release API keeps at most this many failures; the counts stay exact. */
export const MAX_FAILURES = 500;

/** An attribute, or null when the element does not carry it. */
function attr(element: Element, name: string): string | null {
  return element.hasAttribute(name) ? element.getAttribute(name) : null;
}

/** The nearest enclosing suite's file, else its name, as the reporters nest them. */
function suiteFile(testcase: Element): string {
  for (let node = testcase.parentNode; node; node = node.parentNode) {
    if (node.nodeType !== node.ELEMENT_NODE) continue;
    const element = node as Element;
    if (element.tagName !== 'testsuite') continue;
    const named = attr(element, 'file') ?? attr(element, 'name');
    if (named !== null) return named;
  }
  return '';
}

const firstLine = (text: string) => text.trim().split('\n', 1)[0]?.trim() || null;

export function parseJunit(xml: string): JunitSummary {
  const summary: JunitSummary = { total: 0, passed: 0, failed: 0, skipped: 0, failures: [] };
  // A real XML parser, never hand-written patterns over a report someone else wrote.
  const document = new DOMParser({
    errorHandler: { warning: () => {}, error: () => {}, fatalError: () => {} },
  }).parseFromString(xml, 'text/xml');
  const testcases = document.getElementsByTagName('testcase');
  for (let index = 0; index < testcases.length; index += 1) {
    const testcase = testcases.item(index);
    if (!testcase) continue;
    let outcome: 'passed' | 'failed' | 'skipped' = 'passed';
    let message: string | null = null;
    let text = '';
    for (let child = testcase.firstChild; child; child = child.nextSibling) {
      if (child.nodeType !== child.ELEMENT_NODE) continue;
      const element = child as Element;
      if (element.tagName === 'failure' || element.tagName === 'error') {
        outcome = 'failed';
        message = attr(element, 'message') ?? message;
        text += element.textContent ?? '';
      } else if (element.tagName === 'skipped' && outcome !== 'failed') {
        outcome = 'skipped';
      }
    }
    summary.total += 1;
    summary[outcome] += 1;
    if (outcome === 'failed' && summary.failures.length < MAX_FAILURES) {
      summary.failures.push({
        file: attr(testcase, 'file') ?? attr(testcase, 'classname') ?? suiteFile(testcase),
        name: attr(testcase, 'name') ?? '',
        message: (message ? firstLine(message) : null) ?? firstLine(text),
      });
    }
  }
  return summary;
}

/** Several reports (one per shard or package) add up to one summary. */
export function mergeJunit(summaries: readonly JunitSummary[]): JunitSummary {
  const merged: JunitSummary = { total: 0, passed: 0, failed: 0, skipped: 0, failures: [] };
  for (const summary of summaries) {
    merged.total += summary.total;
    merged.passed += summary.passed;
    merged.failed += summary.failed;
    merged.skipped += summary.skipped;
    merged.failures.push(...summary.failures.slice(0, MAX_FAILURES - merged.failures.length));
  }
  return merged;
}
