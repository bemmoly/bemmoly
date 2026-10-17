import { pino, type Logger } from 'pino';

export type { Logger } from 'pino';

/** Tokens travel in the runner's own requests and saved files; none of them may reach a log. */
const REDACT_PATHS = [
  'poolToken',
  'runnerToken',
  'jobToken',
  '*.poolToken',
  '*.runnerToken',
  '*.jobToken',
  'headers["x-bemmoly-runner-token"]',
  'headers["x-bemmoly-job-token"]',
  'values',
];

/** `split` prints its answer on stdout, so its own log lines go to stderr. */
export function createLogger(level: string, fd: 1 | 2 = 1): Logger {
  return pino(
    { name: 'bemmoly-runner', level, redact: { paths: REDACT_PATHS, censor: '***' } },
    pino.destination(fd),
  );
}
