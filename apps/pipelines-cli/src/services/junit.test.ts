import { describe, expect, it } from 'vitest';
import { mergeJunit, parseJunit } from './junit.ts';

const VITEST = `<?xml version="1.0" encoding="UTF-8" ?>
<testsuites name="vitest tests" tests="4" failures="1" errors="0">
  <testsuite name="src/cart.test.ts" tests="3">
    <testcase classname="src/cart.test.ts" name="adds an item" time="0.01"/>
    <testcase classname="src/cart.test.ts" name="rounds totals &amp; taxes" time="0.02">
      <failure message="expected 10.01 to be 10" type="AssertionError"><![CDATA[AssertionError: expected 10.01 to be 10
    at src/cart.test.ts:12:5]]></failure>
    </testcase>
    <testcase classname="src/cart.test.ts" name="applies coupons"><skipped/></testcase>
  </testsuite>
  <!-- a comment with <testcase> inside -->
  <testsuite name="pay" file="src/pay.test.ts">
    <testcase name="charges once"><error>Timeout after 5000ms
second line</error></testcase>
  </testsuite>
</testsuites>`;

describe('JUnit reports', () => {
  it('counts passed, failed, errored and skipped tests', () => {
    const summary = parseJunit(VITEST);
    expect(summary).toMatchObject({ total: 4, passed: 1, failed: 2, skipped: 1 });
  });

  it('keeps each failure with its file and first message line', () => {
    expect(parseJunit(VITEST).failures).toEqual([
      {
        file: 'src/cart.test.ts',
        name: 'rounds totals & taxes',
        message: 'expected 10.01 to be 10',
      },
      { file: 'src/pay.test.ts', name: 'charges once', message: 'Timeout after 5000ms' },
    ]);
  });

  it('adds several reports together', () => {
    const merged = mergeJunit([parseJunit(VITEST), parseJunit(VITEST)]);
    expect(merged).toMatchObject({ total: 8, passed: 2, failed: 4, skipped: 2 });
    expect(merged.failures).toHaveLength(4);
  });

  it('reads an empty report as no tests', () => {
    expect(parseJunit('<testsuites/>')).toEqual({
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      failures: [],
    });
  });
});
