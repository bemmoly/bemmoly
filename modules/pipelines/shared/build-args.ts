import { z } from 'zod';
import { slugSchema } from './common.ts';

/*
 * Build args: `--build-arg NAME=value` for an image build. A value may name the application
 * (`${{ app.name }}`), its folder (`${{ app.path }}`) and the run's inputs. Build args are
 * written into the image's history, where anyone who can pull the image reads them, so an
 * arg named like a secret never takes a value from outside the file.
 */

/** `${{ app.name }}` or `${{ app.path }}`: the application a build is for, and its folder. */
export const APP_INTERPOLATION_PATTERN = /\$\{\{\s*app\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

/** The step env that carries the args to the runner, as a JSON object. */
export const BUILD_ARGS_ENV = 'BEMMOLY_BUILD_ARGS';

const EXPRESSION = /\$\{\{\s*([^}]*?)\s*\}\}/g;
const ALLOWED_EXPRESSION = /^(app\.(name|path)|inputs\.[a-zA-Z_][a-zA-Z0-9_]*)$/;
const SECRET_NAME =
  /(SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|CREDENTIAL|API_?KEY|ACCESS_?KEY|(^|_)KEY$)/i;

/** NPM_TOKEN, DB_PASSWORD, SIGNING_KEY: names that usually hold a secret. */
export function looksLikeSecretName(name: string): boolean {
  return SECRET_NAME.test(name);
}

/** Docker's ARG names; the runner checks them again before they reach a shell. */
export const BUILD_ARG_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;

export const buildArgsSchema = z
  .record(z.string(), z.string().max(2000))
  .superRefine((args, ctx) => {
    const names = Object.keys(args);
    if (names.length > 50) {
      ctx.addIssue({ code: 'custom', message: 'A build takes at most 50 args' });
    }
    for (const [name, value] of Object.entries(args)) {
      if (!BUILD_ARG_NAME.test(name)) {
        ctx.addIssue({
          code: 'custom',
          path: [name],
          message: 'Name build args with letters, digits and underscores, such as SERVICE',
        });
        continue;
      }
      const expressions = [...value.matchAll(EXPRESSION)].map((match) => match[1] ?? '');
      const unknown = expressions.find((expression) => !ALLOWED_EXPRESSION.test(expression));
      if (unknown !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [name],
          message: `Build args take \${{ app.name }}, \${{ app.path }} or \${{ inputs.<name> }}, not \${{ ${unknown} }}`,
        });
      } else if (
        looksLikeSecretName(name) &&
        expressions.some((expression) => !expression.startsWith('app.'))
      ) {
        ctx.addIssue({
          code: 'custom',
          path: [name],
          message: `${name} looks like a secret and build args stay in the image history, so mount the secret in a step instead`,
        });
      }
    }
  });

/** What an application changes of its template's build; its args add to the template's. */
export const buildOverrideSchema = z.object({
  dockerfile: z.string().optional(),
  context: z.string().optional(),
  platforms: z.array(z.string()).optional(),
  pool: slugSchema.optional(),
  args: buildArgsSchema.optional(),
});

export type BuildArgs = z.infer<typeof buildArgsSchema>;
export type BuildOverride = z.infer<typeof buildOverrideSchema>;
