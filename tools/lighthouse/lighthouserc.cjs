// Lighthouse CI budgets for the web shell (tech design §20: first contentful paint under
// 1.2 s, cold, on 4G). The production server serves the built shell, as in the image.
//
// "4G" is spelled out instead of relying on a preset: simulated throttling at 9 Mbps down,
// 1.5 Mbps up and 150 ms round trips (a typical 4G connection), a mid-range phone (4x CPU
// slowdown), and a cold load (Lighthouse clears the cache before every run).

const PORT = 4320;

/** @type {import('@lhci/cli').LighthouseCiConfig} */
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'node apps/server/src/server.ts',
      startServerReadyPattern: 'Server listening',
      startServerReadyTimeout: 30000,
      url: [`http://127.0.0.1:${PORT}/`],
      numberOfRuns: 3,
      settings: {
        onlyCategories: ['performance'],
        formFactor: 'mobile',
        screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75 },
        throttlingMethod: 'simulate',
        throttling: {
          rttMs: 150,
          throughputKbps: 9000,
          uploadThroughputKbps: 1500,
          cpuSlowdownMultiplier: 4,
        },
      },
    },
    assert: {
      assertions: {
        'first-contentful-paint': [
          'error',
          { maxNumericValue: 1200, aggregationMethod: 'median-run' },
        ],
        'total-blocking-time': ['warn', { maxNumericValue: 200, aggregationMethod: 'median-run' }],
        'largest-contentful-paint': [
          'warn',
          { maxNumericValue: 2500, aggregationMethod: 'median-run' },
        ],
        // size-limit gates the gzip size; this flags growth in what the browser downloads.
        'resource-summary:script:size': ['warn', { maxNumericValue: 300000 }],
      },
    },
    upload: { target: 'filesystem', outputDir: '.lighthouseci' },
  },
};
