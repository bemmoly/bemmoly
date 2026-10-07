import pino from 'pino';
import pretty from 'pino-pretty';
import { createLoggerOptions, type Logger, type LoggerConfig } from '../../../config/logger.ts';

export interface StderrLoggerOutput {
  /** Readable lines for a person (`bemmoly restore`); JSON lines for a program (`--json`). */
  human: boolean;
  /** Where the lines go; stderr unless a test captures them. */
  stream?: NodeJS.WritableStream;
}

/**
 * For command-line entry points: logs go to stderr so stdout stays parseable. A
 * transport would ignore the destination, so the pretty printer runs in-process as a
 * synchronous stream.
 */
export function createStderrLogger(config: LoggerConfig, output: StderrLoggerOutput): Logger {
  const options = { ...createLoggerOptions(config) };
  delete options.transport;
  if (!output.human) return pino(options, output.stream ?? pino.destination(2));
  return pino(
    options,
    pretty({
      destination: output.stream ?? 2,
      sync: true,
      colorize: !output.stream && Boolean(process.stderr.isTTY),
      translateTime: 'SYS:HH:MM:ss',
      ignore: 'pid,hostname',
    }),
  );
}
