/*
 * A pipeline that runs for real on a laptop, in both runner modes (processes with --local,
 * containers otherwise): coloured build output and an artifact, unit tests in two shards
 * that write JUnit (one test fails on a first attempt while "flaky" is on, so "Re-run
 * failed" has something to fix and the flaky list has something to show), lint as a matrix
 * and a scan that waits for everything. No repository is needed.
 */

const BUILD = [
  'set -e',
  'printf "\\033[1mBuilding ${BEMMOLY_INPUT_SUITE:-smoke} bundle\\033[0m\\n"',
  'for step in "Resolving packages" "Compiling 214 modules" "Writing dist/app.js"; do',
  '  printf "\\033[36m▸\\033[0m %s\\n" "$step"; sleep 1',
  'done',
  'mkdir -p dist && echo "built $(date)" > dist/app.txt',
  'printf "\\033[32m✓ Built in 3.1s\\033[0m  see https://bemmoly.example.com/docs/builds\\n"',
].join('\n');

const UNIT = [
  'set -e',
  'mkdir -p reports',
  'shard=${BEMMOLY_SHARD_INDEX:-1}',
  'echo "Shard $shard of ${BEMMOLY_SHARD_TOTAL:-1}, suite ${BEMMOLY_INPUT_SUITE}"',
  'fail=0',
  'if [ "$shard" = "1" ] && [ "${BEMMOLY_INPUT_FLAKY}" = "true" ] && [ "${BEMMOLY_ATTEMPT}" = "1" ]; then fail=1; fi',
  'for t in charges refunds receipts; do echo "  ✓ payments $t"; sleep 1; done',
  'if [ "$fail" = "1" ]; then',
  '  printf "\\033[31m  ✗ payments retries a timed-out UPI collect\\033[0m\\n"',
  '  echo "Error: connect ETIMEDOUT 10.4.1.7:443 after 5000ms"',
  '  failure=\'<failure message="connect ETIMEDOUT 10.4.1.7:443 after 5000ms">timeout</failure>\'',
  'else',
  '  echo "  ✓ payments retries a timed-out UPI collect"; failure=""',
  'fi',
  'cat > reports/junit-$shard.xml <<XML',
  '<testsuites><testsuite name="payments" tests="4">',
  '<testcase file="src/payments/charges.test.ts" name="charges" time="1.1"/>',
  '<testcase file="src/payments/refunds.test.ts" name="refunds" time="0.9"/>',
  '<testcase file="src/payments/receipts.test.ts" name="receipts" time="1.0"/>',
  '<testcase file="src/payments/upi-$shard.test.ts" name="retries a timed-out UPI collect" time="2.0">$failure</testcase>',
  '</testsuite></testsuites>',
  'XML',
  'if [ "$fail" = "1" ]; then printf "\\033[31m1 failed\\033[0m, 3 passed\\n"; exit 1; fi',
  'printf "\\033[32m4 passed\\033[0m\\n"',
].join('\n');

/**
 * `appDirectory` holds the demo application (scripts/demo/app): its image is what the
 * release is built from and what the local provider deploys, so a canary on the laptop has a
 * real HTTP service to judge.
 */
export function runnerDemoPipeline(pool: string, appDirectory?: string) {
  return {
    checkout: false,
    ...(appDirectory
      ? { build: { dockerfile: `${appDirectory}/Dockerfile`, context: appDirectory, pool } }
      : {}),
    inputs: {
      suite: {
        type: 'choice',
        options: ['smoke', 'full'],
        default: 'smoke',
        description: 'Which tests to run',
      },
      flaky: { type: 'boolean', default: true, description: 'Fail one test on the first try' },
    },
    test: [
      {
        name: 'Build',
        key: 'compile',
        image: 'alpine:3.20',
        run: BUILD,
        artifacts: ['dist/*'],
        pool,
      },
      {
        name: 'Unit',
        image: 'alpine:3.20',
        run: UNIT,
        shards: 2,
        junit: 'reports/*.xml',
        needs: ['compile'],
        pool,
      },
      {
        name: 'Lint',
        image: 'alpine:3.20',
        run: 'echo "Linting with node ${{ matrix.node }}"; sleep 2; echo "0 errors, 0 warnings"',
        matrix: { axes: { node: ['22', '24'] } },
        needs: ['compile'],
        pool,
      },
      {
        name: 'Security scan',
        image: 'alpine:3.20',
        run: 'echo "Scanning 1,204 packages"; sleep 2; printf "\\033[33m1 low\\033[0m, 0 high\\n"',
        needs: ['unit', 'lint'],
        pool,
      },
    ],
    schedules: [{ cron: '0 3 * * 1-5', timeZone: 'Asia/Kolkata' }],
  };
}
