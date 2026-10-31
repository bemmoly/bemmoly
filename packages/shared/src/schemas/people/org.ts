import { z } from 'zod';
import { timestampSchema } from '../contracts/common.ts';

/*
 * The org entities a person record points at (ADR 0050). Teams are the identity teams;
 * locations and cost centres are People's own.
 */

const isTimezone = (value: string) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

/** An IANA zone such as `Europe/Berlin`; the runtime's zone database decides. */
export const timezoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine(isTimezone, 'Use an IANA time zone such as Europe/Berlin');

/** ISO 3166-1 alpha-2, upper case. */
export const countryCodeSchema = z
  .string()
  .regex(/^[A-Za-z]{2}$/, 'Use a two-letter country code')
  .transform((value) => value.toUpperCase());

const orgNameSchema = z.string().trim().min(1).max(120);

export const locationSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  timezone: z.string(),
  countryCode: z.string().nullable(),
  /** A key the time-off product resolves, such as `de-be`; People does not interpret it. */
  holidayCalendar: z.string().nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const createLocationSchema = z.object({
  name: orgNameSchema,
  timezone: timezoneSchema,
  countryCode: countryCodeSchema.nullish(),
  holidayCalendar: z.string().trim().min(1).max(64).nullish(),
});

export const updateLocationSchema = createLocationSchema.partial();

export const costCentreSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  ownerUserId: z.uuid().nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const createCostCentreSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(32)
    .regex(/^[A-Za-z0-9._-]+$/, 'Use letters, digits, dots, dashes or underscores'),
  name: orgNameSchema,
  ownerUserId: z.uuid().nullish(),
});

export const updateCostCentreSchema = createCostCentreSchema.partial();

export const locationsResponseSchema = z.object({ items: z.array(locationSchema) });
export const costCentresResponseSchema = z.object({ items: z.array(costCentreSchema) });

export type Location = z.infer<typeof locationSchema>;
export type CreateLocationInput = z.infer<typeof createLocationSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
export type CostCentre = z.infer<typeof costCentreSchema>;
export type CreateCostCentreInput = z.infer<typeof createCostCentreSchema>;
export type UpdateCostCentreInput = z.infer<typeof updateCostCentreSchema>;
