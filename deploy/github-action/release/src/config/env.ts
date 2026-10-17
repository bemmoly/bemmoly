import { z } from 'zod';

/*
 * The action's inputs and the runner's environment, parsed once. GitHub passes each input
 * as INPUT_<NAME> with the name upper-cased (hyphens kept), and an unset input as "".
 */

const optional = z
  .string()
  .optional()
  .transform((value) => (value?.trim() ? value.trim() : undefined));

const lines = optional.transform((value) =>
  (value ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0),
);

export const actionEnvSchema = z.object({
  INPUT_SERVER: z.url({
    protocol: /^https?$/,
    error: 'server must be the Bemmoly address, https://…',
  }),
  INPUT_APPLICATION: z.string().trim().min(1, 'application is required'),
  INPUT_IMAGE: optional,
  INPUT_IMAGES: lines,
  'INPUT_IMAGE-REPOSITORY': optional,
  INPUT_VERSION: optional,
  INPUT_TESTS: lines,
  INPUT_NOTES: optional,
  INPUT_TOKEN: optional,
  GITHUB_SHA: z.string().regex(/^[0-9a-f]{7,64}$/, 'GITHUB_SHA is not a commit sha'),
  GITHUB_REF: optional,
  GITHUB_SERVER_URL: z.string().default('https://github.com'),
  GITHUB_REPOSITORY: optional,
  GITHUB_RUN_ID: optional,
  GITHUB_WORKSPACE: optional,
  GITHUB_OUTPUT: optional,
  GITHUB_STEP_SUMMARY: optional,
  ACTIONS_ID_TOKEN_REQUEST_URL: optional,
  ACTIONS_ID_TOKEN_REQUEST_TOKEN: optional,
});

export type ActionEnv = z.output<typeof actionEnvSchema>;

export function parseActionEnv(source: Readonly<Record<string, string | undefined>>): ActionEnv {
  const parsed = actionEnvSchema.safeParse(source);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  throw new Error(issue?.message ?? 'The action inputs are not valid');
}

export function readActionEnv(): ActionEnv {
  return parseActionEnv(process.env);
}
