/*
 * JUnit XML, as every test runner writes it (Jest, Vitest, pytest, Go's gotestsum, Maven
 * Surefire), read into the release's test summary. A small tag scanner rather than an XML
 * library: reports are flat, and only testcase elements and their failure, error and skipped
 * children matter. Comments, processing instructions and CDATA are skipped or read as text.
 */

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

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith('#')) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return ENTITIES[entity.toLowerCase()] ?? whole;
  });
}

function attributes(source: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const match of source.matchAll(/([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    result[match[1] ?? ''] = decode(match[2] ?? match[3] ?? '');
  }
  return result;
}

const TOKEN =
  /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;

interface OpenCase {
  file: string;
  name: string;
  outcome: 'passed' | 'failed' | 'skipped';
  message: string | null;
  text: string;
}

const firstLine = (text: string) => text.trim().split('\n', 1)[0]?.trim() || null;

export function parseJunit(xml: string): JunitSummary {
  const summary: JunitSummary = { total: 0, passed: 0, failed: 0, skipped: 0, failures: [] };
  const suites: string[] = [];
  let current: OpenCase | null = null;
  let inProblem = false;

  const close = (test: OpenCase) => {
    summary.total += 1;
    summary[test.outcome] += 1;
    if (test.outcome === 'failed' && summary.failures.length < MAX_FAILURES) {
      summary.failures.push({
        file: test.file,
        name: test.name,
        message: (test.message ? firstLine(test.message) : null) ?? firstLine(test.text),
      });
    }
  };

  for (const match of xml.matchAll(TOKEN)) {
    const [, cdata, slash, tag, attrText = '', selfClosing, text] = match;
    if (cdata !== undefined || text !== undefined) {
      if (current && inProblem) current.text += cdata ?? decode(text ?? '');
      continue;
    }
    if (!tag) continue;
    const name = tag.toLowerCase();
    if (slash) {
      if (name === 'testsuite') suites.pop();
      if (name === 'failure' || name === 'error') inProblem = false;
      if (name === 'testcase' && current) {
        close(current);
        current = null;
      }
      continue;
    }
    const attrs = attributes(attrText);
    if (name === 'testsuite') {
      if (!selfClosing) suites.push(attrs.file ?? attrs.name ?? suites.at(-1) ?? '');
    } else if (name === 'testcase') {
      const test: OpenCase = {
        file: attrs.file ?? attrs.classname ?? suites.at(-1) ?? '',
        name: attrs.name ?? '',
        outcome: 'passed',
        message: null,
        text: '',
      };
      if (selfClosing) close(test);
      else current = test;
    } else if (current && (name === 'failure' || name === 'error')) {
      current.outcome = 'failed';
      current.message = attrs.message ?? current.message;
      inProblem = !selfClosing;
    } else if (current && name === 'skipped' && current.outcome !== 'failed') {
      current.outcome = 'skipped';
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
