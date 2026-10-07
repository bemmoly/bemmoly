import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@bemmoly/shared';
import { z } from 'zod';

/**
 * The sign-in forms check the identity stream's limits with the shell's own
 * wording; the API client still validates the request with the shared schema.
 */
const email = z
  .string()
  .trim()
  .min(1, 'Enter your email address')
  .pipe(z.email('Enter a valid email address'));

const newPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, 'That password is too long');

export const loginForm = z.object({ email, password: z.string().min(1, 'Enter your password') });

export const resetRequestForm = z.object({ email });

export const resetForm = z.object({ token: z.string().min(1), password: newPassword });

export const acceptForm = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(100, 'Use at most 100 characters'),
  password: newPassword,
});
