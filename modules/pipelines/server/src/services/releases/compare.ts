import type { SqlExecutor } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type {
  CompareQuery,
  ConfigChange,
  Migration,
  ReleaseCompare,
} from '../../../../shared/releases.ts';

/*
 * What is different between two releases, or between what two environments run: the
 * commits built in between (from the runs on the default branch), the issues they name,
 * migrations and configuration the newer release carries, and the forge's compare link.
 * "Prod is 4 commits behind Staging" is this, read the other way round.
 */

interface Side {
  id: string;
  version: string;
  commit_sha: string;
  created_at: string;
  application_id: string;
  resolved_config: Record<string, unknown>;
  repository_url: string | null;
}

const SIDE = `r.id, r.version, r.commit_sha, r.created_at, r.application_id, r.resolved_config,
  repo.url as repository_url
  from pipeline_releases r
  join pipeline_applications a on a.id = r.application_id
  left join pipeline_repositories repo on repo.id = a.repository_id`;

const SECRET = /(secret|token|password|passwd|private|credential|api[_-]?key)/i;

function configChanges(from: Record<string, unknown>, to: Record<string, unknown>): ConfigChange[] {
  const skip = (name: string) => name === 'migrations' || name.startsWith('fake.');
  const names = [...new Set([...Object.keys(from), ...Object.keys(to)])].filter((n) => !skip(n));
  const text = (value: unknown) =>
    value === undefined ? null : typeof value === 'string' ? value : JSON.stringify(value);
  return names
    .filter((name) => text(from[name]) !== text(to[name]))
    .sort()
    .map((name) => {
      const secret = SECRET.test(name);
      return {
        name,
        from: secret ? null : text(from[name]),
        to: secret ? null : text(to[name]),
        secret,
      };
    });
}

function migrationsOf(config: Record<string, unknown>): Migration[] {
  const list = config['migrations'];
  if (!Array.isArray(list)) return [];
  return list.flatMap((item: unknown) => {
    if (typeof item !== 'object' || item === null) return [];
    const m = item as Record<string, unknown>;
    if (typeof m['description'] !== 'string') return [];
    return [
      {
        description: m['description'],
        reversible: m['reversible'] === true,
        reviewed: m['reviewed'] === true,
      },
    ];
  });
}

async function sides(sql: SqlExecutor, query: CompareQuery): Promise<[Side | null, Side]> {
  if ('from' in query) {
    const rows = await sql<Side[]>`
      select ${sql.unsafe(SIDE)} where r.id in (${query.from}, ${query.to})`;
    const to = rows.find((row) => row.id === query.to);
    if (!to) throw new NotFoundError('That release does not exist');
    return [rows.find((row) => row.id === query.from) ?? null, to];
  }
  const running = (env: string) => sql<Side[]>`
    select ${sql.unsafe(SIDE)}
    join pipeline_current c on c.release_id = r.id and c.application_id = a.id
    join pipeline_environments e on e.id = c.environment_id
    where a.key = ${query.application} and e.key = ${env}`;
  const [[from], [to]] = await Promise.all([running(query.fromEnv), running(query.toEnv)]);
  if (!to) throw new NotFoundError(`Nothing runs in ${query.toEnv} yet`);
  return [from ?? null, to];
}

export async function compareReleases(
  sql: SqlExecutor,
  query: CompareQuery,
): Promise<ReleaseCompare> {
  const [from, to] = await sides(sql, query);
  const since = from ? new Date(from.created_at).toISOString() : '-infinity';
  const until = new Date(to.created_at).toISOString();
  const commits = await sql<
    {
      sha: string;
      message: string;
      issue_key: string | null;
      author_id: string | null;
      author_name: string | null;
      author_login: string | null;
      created_at: string;
    }[]
  >`
    select distinct on (run.commit_sha) run.commit_sha as sha, run.title as message,
      run.issue_key, run.author_user_id as author_id, u.name as author_name,
      run.author_login, run.created_at
    from pipeline_runs run
    join pipeline_run_applications ra on ra.run_id = run.id and ra.application_id = ${to.application_id}
    left join users u on u.id = run.author_user_id
    where run.trigger in ('push', 'merge_group', 'manual', 'external')
      and run.created_at > ${since}::timestamptz and run.created_at <= ${until}::timestamptz
      and run.commit_sha <> ${from?.commit_sha ?? ''}
    order by run.commit_sha, run.created_at desc
    limit 500`;
  const newestFirst = [...commits].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const list = newestFirst.map((c) => ({
    sha: c.sha,
    message: c.message,
    issueKey: c.issue_key,
    author:
      c.author_id && c.author_name
        ? { id: c.author_id, name: c.author_name, avatarUrl: null }
        : null,
    authorLogin: c.author_login,
  }));
  const issueKeys = [...new Set(list.flatMap((c) => (c.issueKey ? [c.issueKey] : [])))].sort();
  const migrations = migrationsOf(to.resolved_config);
  const config = configChanges(from?.resolved_config ?? {}, to.resolved_config);
  const authors = new Set(list.map((c) => c.author?.id ?? c.authorLogin).filter(Boolean));
  return {
    from: from ? { id: from.id, version: from.version } : null,
    to: { id: to.id, version: to.version },
    commits: list,
    issueKeys,
    migrations,
    config,
    counts: {
      commits: list.length,
      issues: issueKeys.length,
      migrations: migrations.length,
      config: config.length,
      authors: authors.size,
    },
    compareUrl:
      to.repository_url && from
        ? `${to.repository_url.replace(/\/$/, '')}/compare/${from.commit_sha}...${to.commit_sha}`
        : null,
  };
}
