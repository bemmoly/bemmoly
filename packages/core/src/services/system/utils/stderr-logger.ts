import pino from 'pino';
import { createLoggerOptions, type Logger, type LoggerConfig } from '../../../config/logger.ts';

/** For command-line entry points: logs go to stderr so stdout stays parseable. */
export function createStderrLogger(config: LoggerConfig): Logger {
  // A pretty-print transport would ignore the destination; stderr gets JSON lines.
  const options = { ...createLoggerOptions(config) };
  delete options.transport;
  return pino(options, pino.destination(2));
}
