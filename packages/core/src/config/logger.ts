import { pino, type Logger, type LoggerOptions } from 'pino';
import type { Env } from './env.ts';

const SECRET_FIELDS = [
  'password',
  'passphrase',
  'secret',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'api_key',
  'secretKey',
  'cookie',
  'authorization',
];

/** Configured once: cookies, authorization headers, API keys, tokens and passwords. */
export const REDACT_PATHS: readonly string[] = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["x-api-key"]',
  'req.headers["proxy-authorization"]',
  'res.headers["set-cookie"]',
  'headers.cookie',
  'headers.authorization',
  ...SECRET_FIELDS.flatMap((field) => [field, `*.${field}`, `*.*.${field}`]),
];

export const REDACTED = '[redacted]';

export type LoggerConfig = Pick<Env, 'LOG_LEVEL' | 'LOG_FORMAT'>;

export function createLoggerOptions(config: LoggerConfig): LoggerOptions {
  return {
    level: config.LOG_LEVEL,
    redact: { paths: [...REDACT_PATHS], censor: REDACTED },
    ...(config.LOG_FORMAT === 'pretty'
      ? {
          transport: {
            target: 'pino-pretty',
            options: { translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname' },
          },
        }
      : {}),
  };
}

/** JSON lines in production; pretty output when LOG_FORMAT=pretty (set by `pnpm dev`). */
export function createLogger(config: LoggerConfig): Logger {
  return pino(createLoggerOptions(config));
}

export type { Logger };
