import { z } from 'zod';

/*
 * Device sign-in (RFC 8628) for Bemmoly's own command line tools, such as bp: the tool asks
 * for a code, the person approves it in a browser where they are signed in, and the tool
 * collects an API token limited to its product. Only first-party tools may use it.
 */

export const OAUTH_DEVICE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';

/** Eight letters from an alphabet without vowels or look-alikes, shown as "WDJB-MJHT". */
export const DEVICE_USER_CODE_ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ';

export const deviceUserCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase().replace(/[^A-Z]/g, ''))
  .pipe(
    z
      .string()
      .length(8, 'Codes have eight letters, like WDJB-MJHT')
      .transform((value) => `${value.slice(0, 4)}-${value.slice(4)}`),
  );

/** The form a tool posts to the device authorization endpoint. */
export const oauthDeviceAuthorizationRequestSchema = z.object({
  client_id: z.string().min(1).max(200),
  scope: z.string().max(200).optional(),
  /** "bp on build-box": the name the API token gets, so the person can tell it apart later. */
  device_name: z.string().trim().min(1).max(80).optional(),
});

export const oauthDeviceAuthorizationResponseSchema = z.object({
  device_code: z.string(),
  user_code: z.string(),
  verification_uri: z.string(),
  verification_uri_complete: z.string(),
  expires_in: z.number().int(),
  interval: z.number().int(),
});

export const oauthDeviceRequestQuerySchema = z.object({ userCode: deviceUserCodeSchema });

/** What the device page shows before the person approves. */
export const oauthDeviceRequestSchema = z.object({
  userCode: z.string(),
  clientName: z.string(),
  deviceName: z.string(),
  /** The modules the token will reach. */
  modules: z.array(z.string()),
  access: z.enum(['read', 'write']),
  expiresAt: z.string(),
});

export const decideOAuthDeviceSchema = z.object({
  userCode: deviceUserCodeSchema,
  approve: z.boolean(),
});

export const oauthDeviceDecisionSchema = z.object({ status: z.enum(['approved', 'denied']) });

export type OAuthDeviceAuthorizationRequest = z.infer<typeof oauthDeviceAuthorizationRequestSchema>;
export type OAuthDeviceAuthorizationResponse = z.infer<
  typeof oauthDeviceAuthorizationResponseSchema
>;
export type OAuthDeviceRequest = z.infer<typeof oauthDeviceRequestSchema>;
export type DecideOAuthDeviceInput = z.infer<typeof decideOAuthDeviceSchema>;
export type OAuthDeviceDecision = z.infer<typeof oauthDeviceDecisionSchema>;
