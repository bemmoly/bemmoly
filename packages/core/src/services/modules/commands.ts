import { parseArgs } from 'node:util';
import {
  isBemmolyError,
  moduleAccessChoiceSchema,
  parseOrThrow,
  type AdminModule,
} from '@bemmoly/shared';
import type { Actor } from '../../contracts/authz.ts';
import type { ModuleAdmin } from './admin.ts';

export const MODULES_USAGE = `Usage: bemmoly-db modules <command> [options]

Commands:
  list                       every module in the image with its state
  enable <id>                run its changelog, then enable it (running servers follow);
                             only org admins can open it unless --access says otherwise
  disable <id>               hide it; its data stays
  remove-data <id>           run its down changesets after a backup (module must be disabled)

Options:
  --access <mode>            enable: none (default), everyone or teams
  --team <id>                enable with --access teams: a team id; repeat for more
  --confirm <id>             remove-data: repeat the module id to confirm
  --json                     machine-readable output`;

export interface ModulesCommandDeps {
  admin: ModuleAdmin;
  /** The operator running the CLI, as a system actor. */
  actor: Actor;
}

function line(module: AdminModule): string {
  const state = module.enabled ? 'enabled ' : 'disabled';
  const pending = module.pendingChangesets > 0 ? `, ${module.pendingChangesets} pending` : '';
  return `${module.id.padEnd(16)} ${state}  ${module.version.padEnd(8)} changelog ${module.changelogState}${pending}`;
}

/** `bemmoly-db modules …`: the operator's path to the same service the admin API uses. */
export async function runModulesCommand(
  argv: readonly string[],
  deps: ModulesCommandDeps,
): Promise<{ exitCode: number; output: string }> {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: {
        confirm: { type: 'string' },
        access: { type: 'string', default: 'none' },
        team: { type: 'string', multiple: true },
        json: { type: 'boolean', default: false },
      },
    });
  } catch (error) {
    return { exitCode: 2, output: `${String(error)}\n\n${MODULES_USAGE}` };
  }
  const [scope, command, id] = parsed.positionals;
  const { json } = parsed.values;
  const print = (data: unknown, text: string) => ({
    exitCode: 0,
    output: json ? JSON.stringify(data, null, 2) : text,
  });
  if (scope !== 'modules') return { exitCode: 2, output: MODULES_USAGE };
  try {
    if (command === 'list') {
      const result = await deps.admin.list(deps.actor);
      const header = result.pinned ? 'Pinned by BEMMOLY_MODULES (read-only)\n' : '';
      return print(result, header + result.items.map(line).join('\n'));
    }
    if (!id) return { exitCode: 2, output: MODULES_USAGE };
    if (command === 'enable') {
      const { access, team } = parsed.values;
      const choice = parseOrThrow(moduleAccessChoiceSchema, {
        mode: access,
        ...(team?.length ? { teamIds: team } : {}),
      });
      const module = await deps.admin.enable(deps.actor, id, choice);
      return print(module, line(module));
    }
    if (command === 'disable') {
      const module = await deps.admin.disable(deps.actor, id);
      return print(module, line(module));
    }
    if (command === 'remove-data') {
      const module = await deps.admin.removeData(deps.actor, id, parsed.values.confirm ?? '');
      return print(module, line(module));
    }
    return { exitCode: 2, output: MODULES_USAGE };
  } catch (error) {
    if (isBemmolyError(error)) return { exitCode: 1, output: `error: ${error.message}` };
    throw error;
  }
}
