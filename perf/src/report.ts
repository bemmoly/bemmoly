#!/usr/bin/env node
/**
 * The results table from k6 summary exports (run-k6.sh writes <script>.summary.json): one
 * row per thresholded metric with p50, p95 and p99, the budget, and pass or fail. Markdown,
 * for a pull request, a job summary or a release note.
 *
 *   node perf/src/report.ts results/board.summary.json results/issue.summary.json …
 */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

interface Metric {
  med?: number;
  'p(95)'?: number;
  'p(99)'?: number;
  count?: number;
  value?: number;
  passes?: number;
  fails?: number;
  /** k6's legacy export: true when the threshold was crossed. */
  thresholds?: Record<string, boolean>;
}

export interface Row {
  script: string;
  metric: string;
  budget: string;
  p50: number | null;
  p95: number | null;
  p99: number | null;
  value: string;
  result: 'pass' | 'fail' | 'report';
}

const REPORT_ONLY = 'max>=0';

export function rowsOf(script: string, metrics: Record<string, Metric>): Row[] {
  const rows: Row[] = [];
  for (const [metric, data] of Object.entries(metrics)) {
    if (!data.thresholds) continue;
    const budgets = Object.keys(data.thresholds).filter((t) => t !== REPORT_ONLY);
    const crossed = budgets.some((t) => data.thresholds?.[t]);
    const isTrend = data['p(95)'] !== undefined;
    // Rates export passes, fails and value (the share); counters count and rate (per second).
    let value = '';
    if (data.passes !== undefined && data.value !== undefined) {
      value = `${(data.value * 100).toFixed(2)}% of ${data.passes + (data.fails ?? 0)}`;
    } else if (isTrend) value = `n=${data.count ?? 0}`;
    else if (data.count !== undefined) value = String(data.count);
    rows.push({
      script,
      metric,
      budget: budgets.join(', ') || 'report only',
      p50: isTrend ? (data.med ?? null) : null,
      p95: isTrend ? (data['p(95)'] ?? null) : null,
      p99: isTrend ? (data['p(99)'] ?? null) : null,
      value,
      result: budgets.length === 0 ? 'report' : crossed ? 'fail' : 'pass',
    });
  }
  return rows;
}

export function table(rows: Row[]): string {
  const ms = (value: number | null) => (value === null ? '' : value.toFixed(1));
  return [
    '| Script | Metric | Budget | p50 ms | p95 ms | p99 ms | Value | Result |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: | --- |',
    ...rows.map(
      (r) =>
        `| ${r.script} | \`${r.metric}\` | ${r.budget} | ${ms(r.p50)} | ${ms(r.p95)} | ${ms(r.p99)} | ${r.value} | ${r.result} |`,
    ),
  ].join('\n');
}

function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) throw new Error('Pass one or more <script>.summary.json files');
  const rows = files.flatMap((file) => {
    const summary = JSON.parse(readFileSync(file, 'utf8')) as { metrics: Record<string, Metric> };
    return rowsOf(basename(file).replace(/\.summary\.json$/, ''), summary.metrics);
  });
  process.stdout.write(`${table(rows)}\n`);
  if (rows.some((row) => row.result === 'fail')) process.exitCode = 1;
}

if (import.meta.main) main();
