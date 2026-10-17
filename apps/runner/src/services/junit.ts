import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { TestCaseResult, TestReportUpload } from '@bemmoly/module-pipelines/shared';
import { DOMParser } from '@xmldom/xmldom';
import { expandGlobs } from '../utils/glob.ts';

const MAX_CASES = 50_000;
const MAX_MESSAGE = 4_000;

/** Test files are named by the path a person would open, which classnames only hint at. */
function fileOf(testcase: Element): string {
  for (let node: Element | null = testcase; node; node = parentElement(node)) {
    const file = node.getAttribute('file');
    if (file) return file;
  }
  const classname = testcase.getAttribute('classname') ?? '';
  return classname ? classname.replace(/\./g, '/') : 'unknown';
}

function parentElement(node: Element): Element | null {
  const parent = node.parentNode;
  return parent && parent.nodeType === 1 ? (parent as Element) : null;
}

function firstChild(node: Element, names: readonly string[]): Element | undefined {
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.nodeType === 1 && names.includes((child as Element).tagName)) return child as Element;
  }
  return undefined;
}

function toMs(value: string | null): number {
  const seconds = Number.parseFloat(value ?? '');
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : 0;
}

function toLine(value: string | null): number | null {
  const line = Number.parseInt(value ?? '', 10);
  return Number.isInteger(line) && line > 0 ? line : null;
}

function messageOf(problem: Element): string | null {
  const text = (problem.getAttribute('message') || problem.textContent || '').trim();
  return text ? text.slice(0, MAX_MESSAGE) : null;
}

/**
 * Reads one JUnit XML document: <testsuites>, <testsuite> (nested or not) and <testcase>. A
 * <failure> or <error> fails the case with its message; <skipped> skips it.
 */
export function parseJUnit(xml: string): TestCaseResult[] {
  const errors: string[] = [];
  const document = new DOMParser({
    errorHandler: { error: (message) => errors.push(message), fatalError: (m) => errors.push(m) },
  }).parseFromString(xml, 'text/xml');
  if (errors.length > 0 || !document.documentElement) {
    throw new SyntaxError(`Not valid JUnit XML: ${errors[0] ?? 'no root element'}`);
  }
  const testcases = document.getElementsByTagName('testcase');
  const cases: TestCaseResult[] = [];
  for (let index = 0; index < testcases.length; index++) {
    const testcase = testcases.item(index);
    if (!testcase) continue;
    const problem = firstChild(testcase, ['failure', 'error']);
    const skipped = firstChild(testcase, ['skipped']);
    cases.push({
      file: fileOf(testcase),
      name: testcase.getAttribute('name') || '(unnamed)',
      line: toLine(testcase.getAttribute('line')),
      outcome: problem ? 'failed' : skipped ? 'skipped' : 'passed',
      durationMs: toMs(testcase.getAttribute('time')),
      message: problem ? messageOf(problem) : skipped ? messageOf(skipped) : null,
    });
  }
  return cases;
}

export function summarise(cases: TestCaseResult[]): TestReportUpload {
  const kept = cases.slice(0, MAX_CASES);
  const count = (outcome: TestCaseResult['outcome']) =>
    kept.filter((c) => c.outcome === outcome).length;
  return {
    total: kept.length,
    passed: count('passed'),
    failed: count('failed'),
    skipped: count('skipped'),
    durationMs: kept.reduce((sum, c) => sum + c.durationMs, 0),
    cases: kept,
  };
}

export interface JUnitCollection {
  report: TestReportUpload | undefined;
  files: string[];
  /** Files that matched but could not be read as JUnit, with the reason. */
  problems: { file: string; reason: string }[];
}

/** Every JUnit file the step's pattern matches in the workspace, as one report. */
export async function collectJUnit(pattern: string, workspace: string): Promise<JUnitCollection> {
  const files = await expandGlobs([pattern], workspace);
  const cases: TestCaseResult[] = [];
  const problems: JUnitCollection['problems'] = [];
  for (const file of files) {
    try {
      cases.push(...parseJUnit(await readFile(path.join(workspace, file), 'utf8')));
    } catch (error) {
      problems.push({ file, reason: (error as Error).message });
    }
  }
  return { report: files.length > problems.length ? summarise(cases) : undefined, files, problems };
}
