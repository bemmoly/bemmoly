import { createHash, createHmac } from 'node:crypto';
import { pino, type Logger, type LoggerOptions } from 'pino';
import type { Env } from './env.ts';
import { redactUrl, serializeRequest } from './log-urls.ts';

/** Credentials: cookies, authorization, API keys, tokens, passwords, connection strings. */
const SECRET_FIELDS = [
  'password',
  'passphrase',
  'secret',
  'clientSecret',
  'privateKey',
  'token',
  'accessToken',
  'refreshToken',
  'idToken',
  'apiKey',
  'api_key',
  'secretKey',
  'credentials',
  'cookie',
  'authorization',
  'databaseUrl',
  'connectionString',
  'smtpUrl',
];

/** Content people wrote or an AI was given: email bodies and prompt text. */
const CONTENT_FIELDS = [
  'emailBody',
  'emailHtml',
  'emailText',
  'prompt',
  'promptText',
  'systemPrompt',
  'completion',
];

/** Fields that are content only inside an email or AI object (`email.html`, `ai.messages`). */
const SCOPED_CONTENT_FIELDS: Readonly<Record<string, readonly string[]>> = {
  email: ['body', 'html', 'text'],
  mail: ['body', 'html', 'text'],
  message: ['html', 'text'],
  ai: ['messages', 'input', 'output'],
};

const HEADER_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["x-api-key"]',
  'req.headers["x-metrics-token"]',
  'req.headers["proxy-authorization"]',
  'res.headers["set-cookie"]',
  'headers.cookie',
  'headers.authorization',
  'headers["set-cookie"]',
  'req.body',
  'request.body',
];

const atAnyDepth = (field: string) => [field, `*.${field}`, `*.*.${field}`];

/** Configured once, here. Every logger in the process uses this list. */
export const REDACT_PATHS: readonly string[] = [
  ...HEADER_PATHS,
  ...[...SECRET_FIELDS, ...CONTENT_FIELDS].flatMap(atAnyDepth),
  ...Object.entries(SCOPED_CONTENT_FIELDS).flatMap(([scope, fields]) =>
    fields.flatMap((field) => atAnyDepth(`${scope}.${field}`)),
  ),
];

export const REDACTED = '[redacted]';

/** Log fields that carry a user id. Always written hashed, never raw. */
export const USER_ID_FIELDS = ['userId', 'actorId'] as const;

const USER_HASH_LABEL = 'bemmoly:log-user-id';

/**
 * A stable, non-reversible handle for a user in logs. Keyed with the install's
 * secret when available, so ids cannot be confirmed by hashing guesses.
 */
export function hashUserId(id: string, secretKey?: string): string {
  const digest = secretKey
    ? createHmac('sha256', Buffer.from(secretKey, 'base64')).update(USER_HASH_LABEL).update(id)
    : createHash('sha256').update(USER_HASH_LABEL).update(id);
  return `u_${digest.digest('hex').slice(0, 16)}`;
}

export type LoggerConfig = Pick<Env, 'LOG_LEVEL' | 'LOG_FORMAT'> &
  Partial<Pick<Env, 'BEMMOLY_SECRET_KEY'>>;

/** Hashes user ids and strips credentials from a logged `url`, on every line. */
function formatLogFields(secretKey: string | undefined) {
  return (object: Record<string, unknown>): Record<string, unknown> => {
    let result = object;
    if (typeof object['url'] === 'string') result = { ...result, url: redactUrl(object['url']) };
    for (const field of USER_ID_FIELDS) {
      const value = object[field];
      if (typeof value === 'string') {
        result = { ...result, [field]: hashUserId(value, secretKey) };
      }
    }
    return result;
  };
}

export function createLoggerOptions(config: LoggerConfig): LoggerOptions {
  return {
    level: config.LOG_LEVEL,
    redact: { paths: [...REDACT_PATHS], censor: REDACTED },
    formatters: { log: formatLogFields(config.BEMMOLY_SECRET_KEY) },
    serializers: { req: serializeRequest },
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
