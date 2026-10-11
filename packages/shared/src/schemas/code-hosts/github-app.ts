import { z } from 'zod';
import { codeHostSchema, numericIdSchema, updateCodeHostSchema } from './code-hosts.ts';

/*
 * Connecting GitHub in one click: Bemmoly hands GitHub a manifest of the app it needs (its
 * webhook, read permissions and events), the admin creates it there and installs it on the
 * repositories they choose, and GitHub sends them back with what Bemmoly stores.
 */

/** A GitHub user or organization login. */
const githubLogin = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/, 'The organization name as GitHub shows it');

export const startGithubAppSchema = z.object({
  name: updateCodeHostSchema.shape.name.unwrap(),
  baseUrl: updateCodeHostSchema.shape.baseUrl.unwrap().default(null),
  /** The organization that owns the app; empty creates it under the admin's own account. */
  organization: githubLogin.nullable().default(null),
});
export type StartGithubAppInput = z.input<typeof startGithubAppSchema>;
export type StartGithubApp = z.infer<typeof startGithubAppSchema>;

/** Where the browser goes next: Bemmoly's page that posts the manifest on to GitHub. */
export const githubAppStartSchema = z.object({
  formUrl: z.string(),
  /** False when GitHub cannot reach this install's address, so the app has no webhook. */
  webhooks: z.boolean(),
});
export type GithubAppStart = z.infer<typeof githubAppStartSchema>;

/** The handoff page's address carries the sealed state and nothing else. */
export const githubAppFormQuerySchema = z.object({ state: z.string().trim().min(1).max(4096) });

/** What GitHub sends the browser back with after the app is created. */
export const completeGithubAppSchema = z.object({
  code: z.string().trim().min(1).max(200),
  state: z.string().trim().min(1).max(4096),
});
export type CompleteGithubApp = z.infer<typeof completeGithubAppSchema>;

/** What GitHub sends the browser back with after the app is installed or its access changed. */
export const installGithubAppSchema = z.object({ installationId: numericIdSchema });
export type InstallGithubApp = z.infer<typeof installGithubAppSchema>;

export const githubAppCreatedSchema = z.object({
  host: codeHostSchema,
  /** Where the admin installs the new app and picks its repositories. */
  installUrl: z.string(),
});
export type GithubAppCreated = z.infer<typeof githubAppCreatedSchema>;
