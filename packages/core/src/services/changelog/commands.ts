import { parseArgs } from 'node:util';
import type { ChangelogRollbackTarget } from '../../contracts/changelog.ts';
import { ChangelogError } from './errors.ts';
import {
  formatHistory,
  formatPending,
  formatPlan,
  formatProblems,
  formatRollback,
} from './format.ts';
import { ALL_MODULES } from './rollback.ts';
import type { KernelChangelogRunner } from './runner.ts';
import { isError } from './validate.ts';

export const DB_USAGE = `Usage: bemmoly-db db <command> [options]

Commands:
  status                 pending changesets per module
  validate               checksums, ids, order and missing down; exit 1 on errors
  plan                   print the SQL update would run, without running it
  update                 apply pending changesets (kernel first, then enabled modules)
  history                every recorded changeset, in execution order
  tag <name>             tag the latest applied changeset (e.g. the version being left)
  rollback               run down changesets: --to <id> | --count <n> | --to-tag <tag>

Options:
  --contexts a,b         install contexts (default from BEMMOLY_DB_CONTEXTS)
  --module <id>          module for rollback and history (default: core; * for all)
  --dry-run              rollback: list what would run and what is irreversible
  --retry-started        update: re-run a non-transactional changeset left "started"
  --json                 machine-readable output`;

export interface DbCommandDeps {
  runner: KernelChangelogRunner;
  /** The install's contexts, from env. */
  contexts: readonly string[];
  /** Enabled module ids, in any order; the runner orders them by dependency. */
  enabledModules: readonly string[];
}

export interface DbCommandResult {
  exitCode: number;
  output: string;
}

const ok = (output: string): DbCommandResult => ({ exitCode: 0, output });
const usage = (message: string): DbCommandResult => ({
  exitCode: 2,
  output: `${message}\n\n${DB_USAGE}`,
});

function parse(argv: readonly string[]) {
  return parseArgs({
    args: [...argv],
    allowPositionals: true,
    strict: true,
    options: {
      contexts: { type: 'string' },
      module: { type: 'string' },
      to: { type: 'string' },
      count: { type: 'string' },
      'to-tag': { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      'retry-started': { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
    },
  });
}

type Parsed = ReturnType<typeof parse>['values'];

function rollbackTarget(values: Parsed): ChangelogRollbackTarget | undefined {
  if (values.to) return { toId: values.to };
  if (values['to-tag']) return { toTag: values['to-tag'] };
  if (values.count !== undefined) return { count: Number(values.count) };
  return undefined;
}

async function dispatch(
  command: string | undefined,
  args: readonly string[],
  values: Parsed,
  deps: DbCommandDeps,
): Promise<DbCommandResult> {
  const { runner } = deps;
  const json = values.json;
  const contexts = values.contexts?.split(',').map((c) => c.trim()) ?? [...deps.contexts];
  const selection = { contexts, modules: deps.enabledModules };
  const print = (data: unknown, text: string) => ok(json ? JSON.stringify(data, null, 2) : text);
  switch (command) {
    case 'status': {
      const pending = await runner.status(selection);
      return print(pending, formatPending(pending));
    }
    case 'validate': {
      const problems = await runner.validate();
      const failed = problems.some(isError);
      const result = print(problems, formatProblems(problems));
      return { ...result, exitCode: failed ? 1 : 0 };
    }
    case 'plan': {
      const planned = await runner.plan(selection);
      return print(planned, formatPlan(planned));
    }
    case 'update': {
      const applied = await runner.update({ ...selection, retryStarted: values['retry-started'] });
      return print(applied, applied.length === 0 ? 'Nothing to apply.' : formatHistory(applied));
    }
    case 'history': {
      const module = values.module === ALL_MODULES ? undefined : values.module;
      const rows = await runner.history(module);
      return print(rows, formatHistory(rows));
    }
    case 'tag': {
      const [name] = args;
      if (!name) return usage('tag needs a name');
      const row = await runner.tag(name);
      return print(row, `Tagged ${row.module}/${row.id} as ${name}.`);
    }
    case 'rollback': {
      const target = rollbackTarget(values);
      if (!target) return usage('rollback needs --to <id>, --count <n> or --to-tag <tag>');
      const module = values.module ?? ('toTag' in target ? ALL_MODULES : 'core');
      if (values['dry-run']) {
        const plan = await runner.rollbackPlan(module, target);
        return { ...print(plan, formatRollback(plan)), exitCode: plan.irreversible.length ? 1 : 0 };
      }
      const rolled = await runner.rollback(module, target);
      return print(rolled, rolled.length === 0 ? 'Nothing to roll back.' : formatHistory(rolled));
    }
    default:
      return usage(command ? `Unknown command "${command}"` : 'Missing command');
  }
}

/** `bemmoly-db db <command>`: what Stream F's `bemmoly db …` wrapper calls. */
export async function runDbCommand(
  argv: readonly string[],
  deps: DbCommandDeps,
): Promise<DbCommandResult> {
  let parsed;
  try {
    parsed = parse(argv);
  } catch (error) {
    return usage(error instanceof Error ? error.message : String(error));
  }
  const [scope, command, ...args] = parsed.positionals;
  if (scope !== 'db') return usage(scope ? `Unknown scope "${scope}"` : 'Missing scope');
  try {
    return await dispatch(command, args, parsed.values, deps);
  } catch (error) {
    if (error instanceof ChangelogError) return { exitCode: 1, output: `error: ${error.message}` };
    throw error;
  }
}
