import { connect, keyValues, parse, SERVER_FLAGS, type Context } from '../cli/context.ts';
import { usageError } from '../cli/errors.ts';
import { followJob, followRun, kindOfId } from '../services/follow.ts';

/*
 * bp run starts a pipeline for one application; bp logs prints a run's or a job's log and,
 * with -f, follows it until it finishes. Both exit 1 when the run they followed failed, so
 * scripts can wait on them.
 */

const RUN_OPTIONS = {
  ...SERVER_FLAGS,
  ref: { type: 'string' },
  commit: { type: 'string' },
  input: { type: 'string', multiple: true },
  var: { type: 'string', multiple: true },
  follow: { type: 'boolean', short: 'f' },
} as const;

export async function runCommand(ctx: Context, argv: readonly string[]): Promise<number> {
  const { values, positionals } = parse(argv, RUN_OPTIONS);
  const application = positionals[0];
  if (!application) throw usageError('Name the application: bp run checkout-api');
  const { client } = await connect(ctx, values);
  const run = await client.createRun({
    application,
    ...(values.ref ? { ref: values.ref } : {}),
    ...(values.commit ? { commitSha: values.commit } : {}),
    inputs: keyValues(values.input, '--input'),
    variables: keyValues(values.var, '--var'),
  });
  ctx.output.out(`Run ${run.number} ${run.state} for ${application} on ${run.ref} (${run.id}).`);
  if (!values.follow) {
    ctx.output.out(`Follow it with: bp logs ${run.id} -f`);
    return 0;
  }
  const finished = await followRun(
    { client, print: (line) => ctx.output.out(line), sleep: ctx.sleep, follow: true },
    run.id,
  );
  ctx.output.out(`Run ${finished.number} ${finished.state}.`);
  return finished.state === 'passed' ? 0 : 1;
}

const LOG_OPTIONS = {
  ...SERVER_FLAGS,
  follow: { type: 'boolean', short: 'f' },
  tail: { type: 'string' },
} as const;

export async function logsCommand(ctx: Context, argv: readonly string[]): Promise<number> {
  const { values, positionals } = parse(argv, LOG_OPTIONS);
  const id = positionals[0];
  if (!id) throw usageError('Name a run or a job: bp logs <id> -f');
  const tail = values.tail === undefined ? undefined : Number(values.tail);
  if (tail !== undefined && (!Number.isInteger(tail) || tail < 1 || tail > 5000)) {
    throw usageError('--tail takes a number of lines from 1 to 5000');
  }
  const { client } = await connect(ctx, values);
  const options = {
    client,
    print: (line: string) => ctx.output.out(line),
    sleep: ctx.sleep,
    follow: values.follow ?? false,
    tail,
  };
  if ((await kindOfId(client, id)) === 'job') {
    await followJob(options, id);
    return 0;
  }
  const run = await followRun(options, id);
  if (options.follow) ctx.output.out(`Run ${run.number} ${run.state}.`);
  return run.state === 'failed' ? 1 : 0;
}
