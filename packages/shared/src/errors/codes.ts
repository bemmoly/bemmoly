import { z } from 'zod';

export const ERROR_CODES = [
  'bad_request',
  'validation_failed',
  'unauthenticated',
  'forbidden',
  'module_access_denied',
  'not_found',
  'module_not_enabled',
  'conflict',
  'payload_too_large',
  'rate_limited',
  'provider_error',
  'maintenance',
  'internal_error',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const errorCodeSchema = z.enum(ERROR_CODES);
