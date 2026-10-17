import { APPLICATION_FILE_PATH } from '@bemmoly/module-pipelines/shared';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { parse, type Context } from '../cli/context.ts';
import { formatProblem, lintText } from '../services/lint.ts';

/*
 * bp lint [paths…]: no server, no sign-in. A folder is searched for .bemmoly/ files (not
 * inside node_modules or .git); with no path, the current folder is.
 */

const SKIP = new Set(['node_modules', '.git', 'dist', 'vendor']);

async function filesIn(path: string): Promise<string[]> {
  const info = await stat(path).catch(() => null);
  if (!info) return [];
  if (info.isFile()) return [path];
  const found: string[] = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const child = join(path, entry.name);
    if (entry.isDirectory()) found.push(...(await filesIn(child)));
    else if (/\.ya?ml$/.test(entry.name) && path.endsWith('.bemmoly')) found.push(child);
  }
  return found;
}

export async function lintCommand(ctx: Context, argv: readonly string[]): Promise<number> {
  const { positionals } = parse(argv, {});
  const roots = positionals.length > 0 ? positionals : ['.'];
  const files = (await Promise.all(roots.map(filesIn))).flat();
  if (files.length === 0) {
    ctx.output.err(`No ${APPLICATION_FILE_PATH} or pipeline files found in ${roots.join(', ')}.`);
    return 1;
  }
  let problems = 0;
  for (const file of files) {
    const found = lintText(file, await ctx.readFile(file));
    problems += found.length;
    for (const problem of found) ctx.output.out(formatProblem(problem));
  }
  const checked = `${files.length} ${files.length === 1 ? 'file' : 'files'}`;
  ctx.output.out(
    problems === 0
      ? `${checked} checked, all valid.`
      : `${checked} checked, ${problems} ${problems === 1 ? 'problem' : 'problems'}.`,
  );
  return problems === 0 ? 0 : 1;
}
