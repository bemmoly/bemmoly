import { accessActionSchema } from '@bemmoly/module-pipelines/shared';
import { connect, parse, SERVER_FLAGS, type Context } from '../cli/context.ts';
import { usageError } from '../cli/errors.ts';
import { decisionLines } from '../cli/output.ts';

/*
 * bp why: the access checker from a terminal. "bp why deploy checkout-api --env prod"
 * prints the decision, every binding and policy behind it, and whom to ask. Exits 1 when the
 * answer is no, so a script can check before it tries.
 */

const ACTIONS = accessActionSchema.options.join(', ');

export async function whyCommand(ctx: Context, argv: readonly string[]): Promise<number> {
  const { values, positionals } = parse(argv, {
    ...SERVER_FLAGS,
    env: { type: 'string' },
    user: { type: 'string' },
  });
  const [actionText, application] = positionals;
  const action = accessActionSchema.safeParse(actionText?.replaceAll('-', '_'));
  if (!action.success)
    throw usageError(`Use: bp why <action> <application>, where action is one of ${ACTIONS}`);
  const { client } = await connect(ctx, values);
  const decision = await client.checkAccess({
    action: action.data,
    ...(application ? { application } : {}),
    ...(values.env ? { environment: values.env } : {}),
    ...(values.user ? { user: values.user } : {}),
  });
  for (const line of decisionLines(decision)) ctx.output.out(line);
  return decision.allowed ? 0 : 1;
}
